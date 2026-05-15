import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TelegramModule } from './telegram/telegram.module';
import { ContentModule } from './content/content.module';
import { QueuesModule } from './queues/queues.module';
import { SchedulesModule } from './schedules/schedules.module';
import { PostHistoryModule } from './post-history/post-history.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AccountsModule,
    TelegramModule,
    ContentModule,
    QueuesModule,
    SchedulesModule,
    PostHistoryModule,
  ],
})
export class AppModule { }

export function setupSwagger(app: any) {
  const config = new DocumentBuilder()
    .setTitle('Multi-Tenant Social Media Manager')
    .setDescription(
      'API for managing multi-tenant social media with LinkedIn integration and content generation',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('LinkedIn Accounts')
    .addTag('Queues')
    .addTag('Content')
    .addTag('Schedules')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
