import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
export class CampaignsPollerService implements OnModuleInit {
  private readonly logger = new Logger(CampaignsPollerService.name);
  private isRunning = false;
  private readonly cronExpr = process.env.CAMPAIGN_POLL_CRON ?? '0 */5 * * * *';

  constructor(private readonly campaignsService: CampaignsService) {}

  onModuleInit() {
    this.logger.log(
      `[Cron] REG   schedule="campaign-comment-poller" expr="${this.cronExpr}" registeredAt=${new Date().toISOString()}`,
    );
  }

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
      this.logger.warn(`[Cron] SKIP  schedule="campaign-comment-poller" expr="${this.cronExpr}" — previous cycle still running`);
      return;
    }

    this.isRunning = true;
    const start = Date.now();
    this.logger.log(`[Cron] FIRE  schedule="campaign-comment-poller" expr="${this.cronExpr}" firedAt=${new Date().toISOString()}`);

    try {
      await this.campaignsService.pollAllCampaigns();
      this.logger.log(`[Cron] DONE  schedule="campaign-comment-poller" durationMs=${Date.now() - start}`);
    } catch (err: any) {
      this.logger.error(`Campaign poll cycle failed: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
