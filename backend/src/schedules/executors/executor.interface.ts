import { Schedule } from '../schemas/schedule.schema';
import { IPublisher } from '../../providers';

export interface ChannelPublishResult {
  provider: string;
  accountId: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export interface ExecuteResult {
  posted: boolean;
  itemId?: string;
  channelResults: ChannelPublishResult[];
}

export interface ScheduleRuntimeConfig {
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string; // decrypted
  aiMaxTokens?: number;
}

export interface IScheduleExecutor {
  readonly type: string;
  execute(
    schedule: Schedule,
    publishers: Map<string, IPublisher>,
    runtimeConfig?: ScheduleRuntimeConfig,
  ): Promise<ExecuteResult>;
}
