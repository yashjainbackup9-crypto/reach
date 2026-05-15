import { Injectable } from '@nestjs/common';
import { IPublisher, PostContent, PublishResult } from './provider.interface';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class TelegramProvider implements IPublisher {
  readonly provider = 'telegram';

  constructor(private readonly telegramService: TelegramService) {}

  async publish(accountId: string, tenantId: string, content: PostContent): Promise<PublishResult> {
    try {
      const results = await this.telegramService.broadcastToBot(accountId, tenantId, content.text, content.imageDataUrl);
      if (!results.length) {
        return { success: false, error: 'Bot has no known chats to broadcast to' };
      }
      const succeeded = results.filter((r) => r.success);
      return {
        success: succeeded.length > 0,
        postId: succeeded.map((r) => r.chatId).join(','),
        error: succeeded.length < results.length
          ? `Failed for chats: ${results.filter((r) => !r.success).map((r) => r.chatId).join(',')}`
          : undefined,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
