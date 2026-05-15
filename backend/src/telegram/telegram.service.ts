import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { TelegramBot } from './schemas/telegram-bot.schema';
import { TelegramMessage } from './schemas/telegram-message.schema';
import { RegisterBotDto } from './dto/telegram.dto';
import { QueuesService } from '../queues/queues.service';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { username?: string; first_name?: string };
    chat: { id: number };
    text?: string;
    date: number;
  };
  channel_post?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    date: number;
  };
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectModel('TelegramBot') private readonly telegramBotModel: Model<TelegramBot>,
    @InjectModel('TelegramMessage') private readonly telegramMessageModel: Model<TelegramMessage>,
    private readonly queuesService: QueuesService,
  ) { }

  // ── Bot management ────────────────────────────────────────────────────────

  async registerBot(userId: Types.ObjectId, tenantId: string, dto: RegisterBotDto) {
    const info = await this.fetchBotInfo(dto.botToken);
    const webhookSecret = randomUUID().replaceAll('-', '');
    const webhookUrl = this.buildWebhookUrl(dto.botToken);

    await this.setWebhook(dto.botToken, webhookUrl, webhookSecret);

    const existing = await this.telegramBotModel.findOne({ userId, tenantId });
    if (existing) {
      if (existing.botToken !== dto.botToken) {
        await this.deleteWebhook(existing.botToken).catch(() => { });
      }
      existing.botToken = dto.botToken;
      existing.botUsername = info.username;
      existing.botName = info.first_name;
      existing.lastUpdateId = 0;
      existing.webhookSecret = webhookSecret;
      return existing.save();
    }

    return this.telegramBotModel.create({
      userId,
      tenantId,
      botToken: dto.botToken,
      botUsername: info.username,
      botName: info.first_name,
      lastUpdateId: 0,
      webhookSecret,
    });
  }

  async getBots(userId: Types.ObjectId, tenantId: string) {
    return this.telegramBotModel.find({ userId, tenantId });
  }

  async deleteBot(botId: string, tenantId: string) {
    const bot = await this.telegramBotModel.findOneAndDelete({ _id: botId, tenantId });
    if (!bot) throw new NotFoundException('Bot not found');
    await this.deleteWebhook(bot.botToken).catch((err) =>
      this.logger.warn(`Failed to delete webhook for bot ${bot.botUsername}: ${err.message}`),
    );
    return { message: 'Bot deleted' };
  }

  // ── Webhook handling ──────────────────────────────────────────────────────

  async handleWebhookUpdate(botToken: string, secretHeader: string | undefined, update: TelegramUpdate): Promise<void> {
    const bot = await this.telegramBotModel.findOne({ botToken, isActive: true });
    if (!bot) {
      this.logger.warn(`Webhook update received for unknown bot token ending ${botToken.slice(-5)}`);
      return;
    }

    if (bot.webhookSecret && secretHeader !== bot.webhookSecret) {
      this.logger.warn(`Webhook secret mismatch for bot ${bot.botUsername}`);
      return;
    }

    await this.processUpdate(bot, update);
  }

  private async processUpdate(bot: TelegramBot, update: TelegramUpdate): Promise<void> {
    const msg = update.message ?? update.channel_post;
    if (!msg?.text) return;

    const chatId = String(msg.chat.id);
    this.logger.log(`Received Telegram message ${msg.message_id} from chat ${chatId} for bot ${bot.botUsername}: "${msg.text}"`);

    let isNew = false;
    try {
      const existing = await this.telegramMessageModel.findOneAndUpdate(
        { botId: bot._id, chatId, messageId: msg.message_id },
        {
          $setOnInsert: {
            botId: bot._id,
            tenantId: bot.tenantId,
            chatId,
            messageId: msg.message_id,
            updateId: update.update_id,
            text: msg.text,
            fromUsername: update.message?.from?.username ?? undefined,
            fromFirstName: update.message?.from?.first_name ?? undefined,
            sentAt: new Date(msg.date * 1000),
          },
        },
        { upsert: true, new: false },
      );
      isNew = existing === null;
    } catch {
      // duplicate key race — already stored, skip
    }

    if (isNew) {
      this.logger.log(`Queuing Telegram message ${msg.message_id} from chat ${chatId} (tenant ${bot.tenantId})`);
      
      const text = msg.text.trim();
      const isInstagramUrl = text.includes('instagram.com/');

      if (isInstagramUrl) {
        // Notify user that link is being processed
        await this.sendMessage(bot.botToken, chatId, '✅ Link received! I am processing your Instagram link now. I will let you know once it is ready.').catch(err => 
          this.logger.warn(`Failed to send confirmation to chat ${chatId}: ${err.message}`)
        );

        await this.queuesService.addItem(bot.userId, bot.tenantId, {
          type: 'instagram_link',
          source: 'automated',
          url: text,
          metadata: {
            telegramChatId: chatId,
            telegramBotId: bot._id.toString(),
          },
        });
      } else {
        await this.queuesService.addItem(bot.userId, bot.tenantId, {
          type: 'text',
          source: 'automated',
          text: text,
          metadata: {
            telegramChatId: chatId,
            telegramBotId: bot._id.toString(),
          },
        });
        await this.sendMessage(bot.botToken, chatId, '📝 Text received and added to your queue!').catch(err => 
          this.logger.warn(`Failed to send confirmation to chat ${chatId}: ${err.message}`)
        );
      }
    }
  }

  // ── Telegram API helpers ──────────────────────────────────────────────────

  private buildWebhookUrl(botToken: string): string {
    const base = process.env.TELEGRAM_WEBHOOK_BASE_URL ?? '';
    return `${base}/api/telegram/webhook/${botToken}`;
  }

  private async setWebhook(botToken: string, url: string, secretToken: string): Promise<void> {
    await this.requestTelegramApi(`${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secretToken }),
    });
    this.logger.log(`Webhook set for bot token ending ${botToken.slice(-5)}`);
  }

  private async deleteWebhook(botToken: string): Promise<void> {
    await this.requestTelegramApi(`${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    this.logger.log(`Webhook deleted for bot token ending ${botToken.slice(-5)}`);
  }

  private async requestTelegramApi<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${TELEGRAM_API}${path}`, options);
    const bodyText = await res.text();
    const contentType = res.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
      throw new Error(
        `Telegram API returned non-JSON response (${res.status} ${res.statusText}): ${bodyText.slice(0, 200)}`,
      );
    }

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch (err: unknown) {
      const parseError = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to parse Telegram API JSON response (${res.status} ${res.statusText}): ${bodyText.slice(0, 200)}; parse error: ${parseError}`,
      );
    }

    if (!res.ok || !data.ok) {
      const description = data?.description ?? bodyText;
      throw new Error(
        `Telegram API error (${res.status} ${res.statusText}): ${description}`,
      );
    }

    return data.result as T;
  }

  private async fetchBotInfo(token: string): Promise<{ username: string; first_name: string }> {
    return this.requestTelegramApi<{ username: string; first_name: string }>(`${token}/getMe`);
  }

  async sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
    await this.requestTelegramApi(`${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  async sendPhoto(botToken: string, chatId: string, imageDataUrl: string, caption?: string): Promise<void> {
    const base64 = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', blob, 'image.png');
    if (caption) form.append('caption', caption.slice(0, 1024));
    await this.requestTelegramApi(`${botToken}/sendPhoto`, { method: 'POST', body: form as any });
  }

  async broadcastToBot(
    botId: string,
    tenantId: string,
    text: string,
    imageDataUrl?: string,
  ): Promise<{ chatId: string; success: boolean; error?: string }[]> {
    const bot = await this.telegramBotModel.findOne({ _id: botId, tenantId });
    if (!bot) throw new NotFoundException(`Telegram bot ${botId} not found`);

    const chatIds: string[] = await this.telegramMessageModel.distinct('chatId', { botId: bot._id });

    if (!chatIds.length) {
      this.logger.warn(`Bot ${botId} has no known chats — nothing to broadcast to`);
      return [];
    }

    const results = await Promise.allSettled(
      chatIds.map((chatId) =>
        imageDataUrl
          ? this.sendPhoto(bot.botToken, chatId, imageDataUrl, text)
          : this.sendMessage(bot.botToken, chatId, text),
      ),
    );

    return chatIds.map((chatId, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        this.logger.log(`Broadcast to bot ${bot.botUsername} chat ${chatId}: ok`);
        return { chatId, success: true };
      }
      this.logger.warn(`Broadcast to bot ${bot.botUsername} chat ${chatId}: ${r.reason?.message}`);
      return { chatId, success: false, error: r.reason?.message };
    });
  }

  async sendToBotChat(
    botId: string,
    tenantId: string,
    chatId: string,
    text: string,
  ): Promise<void> {
    const bot = await this.telegramBotModel.findOne({ _id: botId, tenantId });
    if (!bot) throw new NotFoundException(`Telegram bot ${botId} not found`);

    await this.sendMessage(bot.botToken, chatId, text);
  }

}
