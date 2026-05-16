import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignsPollerService } from './campaigns-poller.service';
import { CampaignSchema } from './schemas/campaign.schema';
import { ProcessedCommentSchema } from './schemas/processed-comment.schema';
import { InstagramAccountSchema } from '../accounts/schemas/instagram-account.schema';
import { FacebookAccountSchema } from '../accounts/schemas/facebook-account.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Campaign', schema: CampaignSchema },
      { name: 'ProcessedComment', schema: ProcessedCommentSchema },
      // We read tokens directly from account collections (read-only access)
      { name: 'InstagramAccount', schema: InstagramAccountSchema },
      { name: 'FacebookAccount', schema: FacebookAccountSchema },
    ]),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsPollerService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
