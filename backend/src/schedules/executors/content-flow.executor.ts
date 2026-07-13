import { Injectable, Logger } from '@nestjs/common';
import { IScheduleExecutor, ExecuteResult, ScheduleRuntimeConfig } from './executor.interface';
import { IPublisher } from '../../providers';
import { Schedule } from '../schemas/schedule.schema';
import { QueuesService } from '../../queues/queues.service';
import { TonesService } from '../../content/tones.service';
import { ContentRewriterService } from '../../content/content-rewriter.service';
import { ImageGenerationService } from '../../content/image-generation.service';
import { WebResearchService } from '../../content/web-research.service';
import { TelegramService } from '../../telegram/telegram.service';
import { EncryptionService } from '../../common/encryption.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PostHistoryService } from '../../post-history/post-history.service';

@Injectable()
export class ContentFlowExecutor implements IScheduleExecutor {
  readonly type = 'content-flow';
  private readonly logger = new Logger(ContentFlowExecutor.name);

  constructor(
    private readonly queuesService: QueuesService,
    private readonly tonesService: TonesService,
    private readonly contentRewriterService: ContentRewriterService,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly webResearchService: WebResearchService,
    private readonly telegramService: TelegramService,
    private readonly encryptionService: EncryptionService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly postHistoryService: PostHistoryService,
  ) {}

  async execute(schedule: Schedule, publishers: Map<string, IPublisher>, runtimeConfig?: ScheduleRuntimeConfig): Promise<ExecuteResult> {
    const item = await this.queuesService.getNextReadyItem(schedule.userId, schedule.tenantId);

    if (!item) {
      this.logger.debug(`Schedule ${schedule._id} (${schedule.name}): queue is empty`);
      await this.notifyTelegramChannels(schedule, 'No item available in queue.');
      return { posted: false, channelResults: [] };
    }

    const originalText = item.text ?? item.caption ?? '';
    if (!originalText.trim()) {
      this.logger.warn(`Schedule ${schedule._id}: item ${item.id} has no text or caption — skipping`);
      return { posted: false, channelResults: [] };
    }

    let text = originalText;

    if (schedule.toneId) {
      try {
        const tone = await this.tonesService.findById(schedule.toneId.toString(), schedule.userId, schedule.tenantId);
        if (tone) {
          this.logger.debug(`Schedule ${schedule._id}: rewriting content with tone "${tone.name}"`);
          text = await this.contentRewriterService.rewrite(text, tone.tone, {
            provider: runtimeConfig?.aiProvider,
            model: runtimeConfig?.aiModel,
            apiKey: runtimeConfig?.aiApiKey,
            maxTokens: runtimeConfig?.aiMaxTokens,
          });
        } else {
          this.logger.warn(`Schedule ${schedule._id}: tone ${schedule.toneId} not found — posting original content`);
        }
      } catch (err: any) {
        this.logger.error(`Schedule ${schedule._id}: tone rewrite failed (${err.message}) — will retry next time`);
        await this.notifyTelegramChannels(schedule, `Post skipped: tone rewrite failed (${err.message}).`);
        return { posted: false, channelResults: [] };
      }
    }

    // Generate image if enabled — includes web research and ready-made post formatting
    let imageDataUrl: string | undefined;
    let imageUrl: string | undefined;
    if (schedule.imageConfig?.enabled) {
      try {
        const imgCfg = schedule.imageConfig;

        // Gather web context and analyze any existing media from the queue item
        this.logger.debug(`Schedule ${schedule._id}: running web research for post enrichment`);
        const research = await this.webResearchService.researchContent(text, item.mediaUrls);

        // Append researched hashtags to make a ready-made social media post
        if (research.hashtags.length > 0) {
          const hashtagLine = research.hashtags.map((h) => `#${h}`).join(' ');
          text = `${text}\n\n${hashtagLine}`;
          this.logger.debug(`Schedule ${schedule._id}: appended ${research.hashtags.length} hashtags`);
        }

        // Build enriched image prompt using web context + visual themes + reference image description
        const prompt = this.imageGenerationService.buildPromptFromPost(
          {
            caption: item.caption,
            text: item.text,
            webContext: research.enrichedContext,
            visualThemes: research.visualThemes,
            imageDescription: research.imageDescription,
          },
          imgCfg.customPrompt,
        );

        const apiKey = imgCfg.apiKey ? this.encryptionService.decrypt(imgCfg.apiKey) : undefined;
        const result = await this.imageGenerationService.generateImage(prompt, {
          apiKey,
          size: imgCfg.size,
          quality: imgCfg.quality as any,
          style: imgCfg.style as any,
        });
        imageDataUrl = result.imageDataUrl;
        this.logger.debug(`Schedule ${schedule._id}: image generated using model=${result.model}`);

        // Persist generated image to Cloudinary for history
        try {
          imageUrl = await this.cloudinaryService.uploadBase64Image(imageDataUrl, 'post-history');
          this.logger.debug(`Schedule ${schedule._id}: image uploaded to Cloudinary — ${imageUrl}`);
        } catch (err: any) {
          this.logger.warn(`Schedule ${schedule._id}: Cloudinary upload failed (${err.message}) — continuing without persistent URL`);
        }
      } catch (err: any) {
        this.logger.error(`Schedule ${schedule._id}: image generation failed (${err.message}) — will retry next time`);
        await this.notifyTelegramChannels(schedule, `Post skipped: image generation failed (${err.message}).`);
        return { posted: false, channelResults: [] };
      }
    }

    const channelResults = await Promise.all(
      schedule.channels.map(async (ch) => {
        const publisher = publishers.get(ch.provider);
        if (!publisher) {
          return {
            provider: ch.provider,
            accountId: ch.accountId,
            success: false,
            error: `No publisher registered for provider "${ch.provider}"`,
          };
        }
        // For Instagram, prefer the Cloudinary public URL (imageUrl) since the
        // Graph API requires a publicly accessible URL, not a base64 data URL.
        const isMeta = ch.provider === 'instagram' || ch.provider === 'facebook';
        const publishContent =
          isMeta && imageUrl
            ? { text, mediaUrls: [imageUrl] }
            : { text, imageDataUrl, ...(imageUrl ? { mediaUrls: [imageUrl] } : {}) };
        const result = await publisher.publish(ch.accountId, schedule.tenantId, publishContent);
        return { provider: ch.provider, accountId: ch.accountId, ...result };
      }),
    );

    const anySucceeded = channelResults.some((r) => r.success);
    if (anySucceeded) {
      await this.queuesService.markItemPosted(schedule.userId, schedule.tenantId, item.id);

      // Save post history so content can be reposted later
      try {
        await this.postHistoryService.save({
          userId: schedule.userId,
          tenantId: schedule.tenantId,
          scheduleId: schedule._id as any,
          queueItemId: item.id,
          originalText,
          rewrittenText: text,
          imageUrl,
          channelResults,
        });
        this.logger.debug(`Schedule ${schedule._id}: post history saved`);
      } catch (err: any) {
        this.logger.warn(`Schedule ${schedule._id}: failed to save post history (${err.message})`);
      }
    }

    return { posted: anySucceeded, itemId: item.id, channelResults };
  }

  private async notifyTelegramChannels(schedule: Schedule, message: string): Promise<void> {
    const telegramChannels = schedule.channels.filter(ch => ch.provider === 'telegram');
    await Promise.all(
      telegramChannels.map(ch =>
        this.telegramService
          .broadcastToBot(ch.accountId, schedule.tenantId, message)
          .catch((err: any) =>
            this.logger.warn(`Schedule ${schedule._id}: failed to send telegram notification — ${err.message}`),
          ),
      ),
    );
  }
}
