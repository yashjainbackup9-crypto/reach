import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CronJobSchema } from './schemas/cron-job.schema';
import { CronJobLogSchema } from './schemas/cron-job-log.schema';
import { ServiceApiKeySchema } from './schemas/service-api-key.schema';
import { CronJobsService } from './cron-jobs.service';
import { ServiceApiKeysService } from './service-api-keys.service';
import { CronJobsController } from './cron-jobs.controller';
import { ServiceApiKeysController } from './service-api-keys.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { CronJobAuthGuard } from './guards/cron-job-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CronJob', schema: CronJobSchema },
      { name: 'CronJobLog', schema: CronJobLogSchema },
      { name: 'ServiceApiKey', schema: ServiceApiKeySchema },
    ]),
  ],
  controllers: [CronJobsController, ServiceApiKeysController],
  providers: [
    CronJobsService,
    ServiceApiKeysService,
    EncryptionService,
    ApiKeyGuard,
    CronJobAuthGuard,
    JwtAuthGuard,
  ],
  exports: [CronJobsService, ServiceApiKeysService],
})
export class CronJobsModule {}
