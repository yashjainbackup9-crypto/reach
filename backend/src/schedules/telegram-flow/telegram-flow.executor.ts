import { Injectable, Logger } from '@nestjs/common';
import { IScheduleExecutor, ExecuteResult, ScheduleRuntimeConfig } from '../executors/executor.interface';
import { IPublisher } from '../../providers';
import { Schedule } from '../schemas/schedule.schema';
import { QueuesService } from '../../queues/queues.service';
import { TonesService } from '../../content/tones.service';
import { ContentRewriterService } from '../../content/content-rewriter.service';
import { TelegramService } from '../../telegram/telegram.service';

@Injectable()
export class TelegramFlowExecutor implements IScheduleExecutor {
  readonly type = 'telegram-flow';
  private readonly logger = new Logger(TelegramFlowExecutor.name);

  constructor(
    private readonly queuesService: QueuesService,
    private readonly tonesService: TonesService,
    private readonly contentRewriterService: ContentRewriterService,
    private readonly telegramService: TelegramService,
  ) {}

  async execute(schedule: Schedule, _publishers: Map<string, IPublisher>, runtimeConfig?: ScheduleRuntimeConfig): Promise<ExecuteResult> {
    if (!schedule.telegramBotId) {
      this.logger.error(`Schedule ${schedule._id} (${schedule.name}): telegramBotId is required for telegram-flow`);
      return { posted: false, channelResults: [] };
    }

    const botId = schedule.telegramBotId.toString();

    const item = await this.queuesService.getNextReadyItem(schedule.userId, schedule.tenantId);

    if (!item) {
      this.logger.debug(`Schedule ${schedule._id} (${schedule.name}): queue is empty`);
      await this.telegramService
        .broadcastToBot(botId, schedule.tenantId, 'No item available in queue.')
        .catch((err: any) =>
          this.logger.warn(`Schedule ${schedule._id}: failed to send empty-queue notification — ${err.message}`),
        );
      return { posted: false, channelResults: [] };
    }

    let text = item.text || item.caption || '';
    if (!text.trim()) {
      this.logger.warn(`Schedule ${schedule._id}: item ${item.id} has no text or caption — skipping`);
      return { posted: false, channelResults: [] };
    }

    if (schedule.toneId) {
      try {
        const tone = await this.tonesService.findById(
          schedule.toneId.toString(),
          schedule.userId,
          schedule.tenantId,
        );
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
        this.logger.error(`Schedule ${schedule._id}: tone rewrite failed (${err.message}) — aborting post`);
        return { posted: false, channelResults: [] };
      }
    }

    const broadcastResults = await this.telegramService
      .broadcastToBot(botId, schedule.tenantId, text)
      .catch((err: any) => {
        this.logger.error(`Schedule ${schedule._id}: broadcast failed — ${err.message}`);
        return [];
      });

    const channelResults = broadcastResults.map((r) => ({
      provider: 'telegram',
      accountId: r.chatId,
      success: r.success,
      error: r.error,
    }));

    const anySucceeded = channelResults.some((r) => r.success);
    if (anySucceeded) {
      await this.queuesService.markItemPosted(schedule.userId, schedule.tenantId, item.id);
    }

    return { posted: anySucceeded, itemId: item.id, channelResults };
  }
}
