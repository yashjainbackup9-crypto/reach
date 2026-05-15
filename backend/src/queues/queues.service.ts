import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Queue, QueueItem } from './schemas/queue.schema';
import { AddQueueItemDto } from './dto/queue.dto';
import { InstagramScraperService } from '../instagram/instagram-scraper.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectModel('Queue') private readonly queueModel: Model<Queue>,
    private readonly instagramScraperService: InstagramScraperService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) { }

  private async getOrCreateQueue(userId: Types.ObjectId, tenantId: string): Promise<Queue> {
    const existing = await this.queueModel.findOne({ userId, tenantId });
    if (existing) return existing;
    return this.queueModel.create({ userId, tenantId, items: [] });
  }

  async getQueue(userId: Types.ObjectId, tenantId: string) {
    const queue = await this.getOrCreateQueue(userId, tenantId);
    return { items: queue.items };
  }

  async addItem(userId: Types.ObjectId, tenantId: string, dto: AddQueueItemDto) {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem: QueueItem = {
      id: itemId,
      source: dto.source ?? 'manual',
      status: 'pending',
      text: dto.text,
      url: dto.url,
      ...dto,
      addedAt: new Date(),
    };

    await this.queueModel.findOneAndUpdate(
      { userId, tenantId },
      { $push: { items: newItem } },
      { upsert: true, new: true },
    );
    this.logger.log(`Added item ${itemId} to queue for user ${userId} (tenant ${tenantId})`);
    this.processItem(userId, tenantId, itemId).catch((err) => {
      this.logger.error(`Failed to process item ${itemId}: ${err.message}`);
    });

    return { message: 'Added to queue', itemId };
  }

  async removeItem(userId: Types.ObjectId, tenantId: string, index: number) {
    const queue = await this.queueModel.findOne({ userId, tenantId });
    if (!queue) throw new NotFoundException('Queue not found');
    queue.items.splice(index, 1);
    await queue.save();
    return { message: 'Removed' };
  }

  async reprocessItem(userId: Types.ObjectId, tenantId: string, index: number) {
    const queue = await this.queueModel.findOne({ userId, tenantId });
    if (!queue) throw new NotFoundException('Queue not found');
    const item = queue.items[index];
    if (!item) throw new NotFoundException('Item not found');
    item.status = 'pending';
    item.error = undefined;
    item.processedAt = undefined;
    await queue.save();
    this.processItem(userId, tenantId, item.id).catch((err) => {
      this.logger.error(`Failed to reprocess item ${item.id}: ${err.message}`);
    });
    return { message: 'Reprocessing' };
  }

  async getNextReadyItem(userId: Types.ObjectId, tenantId: string): Promise<QueueItem | null> {
    const queue = await this.queueModel.findOne({ userId, tenantId });
    if (!queue) return null;
    return queue.items.find((i) => i.status === 'ready') ?? null;
  }

  async markItemPosted(userId: Types.ObjectId, tenantId: string, itemId: string): Promise<void> {
    await this.queueModel.updateOne(
      { userId, tenantId, 'items.id': itemId },
      { $set: { 'items.$.status': 'posted', 'items.$.postedAt': new Date() } },
    );
    this.logger.log(`Marked item ${itemId} as posted for user ${userId} (tenant ${tenantId})`);
  }

  async processItem(userId: Types.ObjectId, tenantId: string, itemId: string) {
    const queue = await this.queueModel.findOne({ userId, tenantId });
    if (!queue) return;

    const item = queue.items.find((i) => i.id === itemId);
    if (!item || item.status !== 'pending') return;

    item.status = 'processing';
    await queue.save();

    // Notify status change
    if (item.metadata?.telegramChatId && item.metadata?.telegramBotId) {
      await this.notifyTelegramStatus(
        item.metadata.telegramBotId as string,
        tenantId,
        item.metadata.telegramChatId as string,
        item.status,
        item.type,
      );
    }

    try {
      if (item.type === 'text') {
        item.status = 'ready';
        item.processedAt = new Date();
      } else if (item.type === 'instagram_link' && item.url) {
        const data = await this.instagramScraperService.scrapePost(item.url);

        item.caption = data.caption;
        item.mediaUrls = data.mediaUrls;
        item.metadata = { author: data.author, pageTitle: data.pageTitle };

        queue.markModified('items'); // 🔥 critical

        item.status = 'ready';
        item.processedAt = new Date();
      } else {
        item.status = 'ready';
        item.processedAt = new Date();
      }
    } catch (err: any) {
      item.status = 'failed';
      item.error = err?.message ?? 'Processing failed';
    }
    this.logger.log(`Processed item ${item.id} with status ${item.status}`);

    await queue.save();

    // Notify final status change
    if (item.metadata?.telegramChatId && item.metadata?.telegramBotId) {
      await this.notifyTelegramStatus(
        item.metadata.telegramBotId as string,
        tenantId,
        item.metadata.telegramChatId as string,
        item.status,
        item.type,
        item.error,
      );
    }
  }

  private async notifyTelegramStatus(botId: string, tenantId: string, chatId: string, status: string, type: string, error?: string) {
    let message = '';
    switch (status) {
      case 'processing':
        if (type === 'instagram_link') {
          message = 'Scraped content from Instagram and added to your queue';
        } else {
          return; // Don't notify processing for other types yet
        }
        break;
      case 'ready':
        message = type === 'instagram_link'
          ? '✨ Instagram content is ready! It has been added to your queue.'
          : '✅ Item added to your queue and is ready to be posted.';
        break;
      case 'failed':
        message = `❌ Failed to process the link: ${error || 'Unknown error'}`;
        break;
      default:
        return;
    }

    try {
      await this.telegramService.sendToBotChat(botId, tenantId, chatId, message);
    } catch (err: any) {
      this.logger.warn(`Failed to notify Telegram status: ${err.message}`);
    }
  }
}
