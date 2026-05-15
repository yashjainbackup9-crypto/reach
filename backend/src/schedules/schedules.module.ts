import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchedulesService } from './schedules.service';
import { ScheduleSchema } from './schemas/schedule.schema';
import { TextExecutor } from './executors/text.executor';
import { TelegramFlowExecutor } from './telegram-flow/telegram-flow.executor';
import { TelegramFlowController } from './telegram-flow/telegram-flow.controller';
import { ContentFlowExecutor } from './executors/content-flow.executor';
import { ContentFlowController } from './content-flow/content-flow.controller';
import { RepostController } from './repost.controller';
import { LinkedInProvider, TelegramProvider, InstagramProvider, FacebookProvider } from '../providers';
import { QueuesModule } from '../queues/queues.module';
import { AccountsModule } from '../accounts/accounts.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ContentModule } from '../content/content.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PostHistoryModule } from '../post-history/post-history.module';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Schedule', schema: ScheduleSchema }]),
    QueuesModule,
    AccountsModule,
    TelegramModule,
    ContentModule,
    CloudinaryModule,
    PostHistoryModule,
  ],
  controllers: [
    TelegramFlowController,
    ContentFlowController,
    RepostController,
  ],
  providers: [
    EncryptionService,

    TextExecutor,
    TelegramFlowExecutor,
    ContentFlowExecutor,
    {
      provide: 'SCHEDULE_EXECUTORS',
      useFactory: (
        text: TextExecutor,
        telegramFlow: TelegramFlowExecutor,
        contentFlow: ContentFlowExecutor,
      ) => [text, telegramFlow, contentFlow],
      inject: [TextExecutor, TelegramFlowExecutor, ContentFlowExecutor],
    },

    {
      provide: 'SCHEDULE_PUBLISHERS',
      useFactory: (
        linkedin: LinkedInProvider,
        telegram: TelegramProvider,
        instagram: InstagramProvider,
        facebook: FacebookProvider,
      ) => [linkedin, telegram, instagram, facebook],
      inject: [LinkedInProvider, TelegramProvider, InstagramProvider, FacebookProvider],
    },

    SchedulesService,
  ],
  exports: [SchedulesService],
})
export class SchedulesModule {}
