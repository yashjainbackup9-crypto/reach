import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignsService } from './campaigns.service';

/**
 * CampaignsPollerService
 *
 * Runs on a configurable cron schedule (default: every 5 minutes) and drives
 * the comment-polling loop for all active campaigns.
 *
 * Override the interval via the CAMPAIGN_POLL_CRON env variable.
 * The default `0 *\/5 * * * *` fires at second 0 of every 5th minute.
 *
 * Skips a polling cycle if the previous one is still running, preventing
 * pile-ups when the Meta API responds slowly.
 */
@Injectable()
export class CampaignsPollerService {
  private readonly logger = new Logger(CampaignsPollerService.name);
  private isRunning = false;

  constructor(private readonly campaignsService: CampaignsService) {}

  /**
   * Primary polling cron — every 5 minutes by default.
   * Set CAMPAIGN_POLL_CRON in .env to customise, e.g.:
   *   "0 *\/2 * * * *"  → every 2 minutes
   *   "0 *\/10 * * * *" → every 10 minutes
   */
  @Cron(process.env.CAMPAIGN_POLL_CRON ?? '0 */5 * * * *', {
    name: 'campaign-comment-poller',
  })
  async handlePoll(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Campaign poll cycle still running — skipping this tick');
      return;
    }

    this.isRunning = true;
    const start = Date.now();
    this.logger.debug('Campaign comment poll cycle started');

    try {
      await this.campaignsService.pollAllCampaigns();
      this.logger.debug(`Campaign poll cycle completed in ${Date.now() - start}ms`);
    } catch (err: any) {
      this.logger.error(`Campaign poll cycle failed: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
