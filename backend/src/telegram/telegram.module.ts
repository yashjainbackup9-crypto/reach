import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotSchema } from './schemas/telegram-bot.schema';
import { TelegramMessageSchema } from './schemas/telegram-message.schema';
import { QueuesModule } from '../queues/queues.module';
import { TelegramProvider } from '../providers/telegram.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'TelegramBot', schema: TelegramBotSchema },
      { name: 'TelegramMessage', schema: TelegramMessageSchema },
    ]),
    forwardRef(() => QueuesModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramProvider],
  exports: [TelegramService, TelegramProvider],
})
export class TelegramModule { }
