import { Injectable, Logger } from '@nestjs/common';
import { IScheduleExecutor, ExecuteResult, ScheduleRuntimeConfig } from './executor.interface';
import { IPublisher } from '../../providers';
import { Schedule } from '../schemas/schedule.schema';
import { QueuesService } from '../../queues/queues.service';

@Injectable()
export class TextExecutor implements IScheduleExecutor {
  readonly type = 'text';
  private readonly logger = new Logger(TextExecutor.name);

  constructor(private readonly queuesService: QueuesService) {}

  async execute(schedule: Schedule, publishers: Map<string, IPublisher>, _runtimeConfig?: ScheduleRuntimeConfig): Promise<ExecuteResult> {
    const item = await this.queuesService.getNextReadyItem(schedule.userId, schedule.tenantId);
    if (!item) {
      this.logger.debug(`Schedule ${schedule._id} (${schedule.name}): queue is empty or no ready items`);
      return { posted: false, channelResults: [] };
    }

    const text = item.text ?? item.caption ?? '';
    if (!text.trim()) {
      this.logger.warn(`Schedule ${schedule._id}: item ${item.id} has no text or caption — skipping`);
      return { posted: false, channelResults: [] };
    }

    const content = { text };

    const channelResults = await Promise.all(
      schedule.channels.map(async (ch) => {
        const publisher = publishers.get(ch.provider);
        if (!publisher) {
          return {
            provider: ch.provider,
            accountId: ch.accountId,
            success: false,
            error: `No publisher registered for provider "${ch.provider}"`,
          };
        }
        const result = await publisher.publish(ch.accountId, schedule.tenantId, content);
        return { provider: ch.provider, accountId: ch.accountId, ...result };
      }),
    );

    const anySucceeded = channelResults.some((r) => r.success);
    if (anySucceeded) {
      await this.queuesService.markItemPosted(schedule.userId, schedule.tenantId, item.id);
    }

    return { posted: anySucceeded, itemId: item.id, channelResults };
  }
}
