import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QueuesController } from './queues.controller';
import { QueuesService } from './queues.service';
import { QueueSchema } from './schemas/queue.schema';
import { InstagramScraperModule } from '../instagram/instagram-scraper.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Queue', schema: QueueSchema }]),
    InstagramScraperModule,
    forwardRef(() => TelegramModule),
  ],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule { }
