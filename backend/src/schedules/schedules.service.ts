import {
  Injectable, Inject, Logger, NotFoundException,
  OnModuleInit, OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as nodeCron from 'node-cron';
import { CronJob } from 'cron';
import { Schedule, ScheduleType, ScheduleAiConfig, ScheduleImageConfig } from './schemas/schedule.schema';
import { IScheduleExecutor, ScheduleRuntimeConfig } from './executors/executor.interface';
import { IPublisher } from '../providers';
import { EncryptionService } from '../common/encryption.service';

interface AiConfigInput {
  provider?: string;
  model?: string;
  apiKey?: string; // plain text — will be encrypted before storage
  maxTokens?: number;
}

interface ImageConfigInput {
  enabled?: boolean;
  customPrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  apiKey?: string; // plain text — will be encrypted before storage
}

interface CreateScheduleData {
  name: string;
  type: ScheduleType;
  telegramBotId?: string;
  toneId?: string;
  times: string[];
  channels?: { provider: string; accountId: string }[];
  aiConfig?: AiConfigInput;
  imageConfig?: ImageConfigInput;
}

interface UpdateScheduleData {
  name?: string;
  telegramBotId?: string;
  toneId?: string;
  times?: string[];
  channels?: { provider: string; accountId: string }[];
  isActive?: boolean;
  aiConfig?: AiConfigInput;
  imageConfig?: ImageConfigInput;
}

@Injectable()
export class SchedulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulesService.name);
  private readonly tasks = new Map<string, nodeCron.ScheduledTask[]>();
  private publisherMap: Map<string, IPublisher>;

  constructor(
    @InjectModel('Schedule') private readonly scheduleModel: Model<Schedule>,
    @Inject('SCHEDULE_EXECUTORS') private readonly executors: IScheduleExecutor[],
    @Inject('SCHEDULE_PUBLISHERS') private readonly publishers: IPublisher[],
    private readonly encryptionService: EncryptionService,
  ) {
    this.publisherMap = new Map(publishers.map((p) => [p.provider, p]));
  }

  async onModuleInit() {
    const active = await this.scheduleModel.find({ isActive: true });
    this.logger.log(`Startup: registering cron jobs for ${active.length} active schedule(s)…`);
    for (const schedule of active) {
      this.registerCrons(schedule);
    }
    this.logger.log(`Startup complete — ${this.tasks.size} schedule(s) running, ${[...this.tasks.values()].reduce((s, t) => s + t.length, 0)} total cron(s) active`);
  }

  onModuleDestroy() {
    for (const tasks of this.tasks.values()) {
      tasks.forEach((t) => t.stop());
    }
  }

  async create(userId: Types.ObjectId, tenantId: string, data: CreateScheduleData): Promise<Schedule> {
    const schedule = await this.scheduleModel.create({
      userId,
      tenantId,
      name: data.name,
      type: data.type,
      telegramBotId: data.telegramBotId ? new Types.ObjectId(data.telegramBotId) : undefined,
      toneId: data.toneId ? new Types.ObjectId(data.toneId) : undefined,
      times: data.times,
      channels: data.channels ?? [],
      aiConfig: this.encryptAiConfig(data.aiConfig),
      imageConfig: this.encryptImageConfig(data.imageConfig),
      isActive: true,
    });
    this.registerCrons(schedule);
    return schedule;
  }

  async findAll(userId: Types.ObjectId, tenantId: string, type?: ScheduleType): Promise<Schedule[]> {
    const filter: Record<string, unknown> = { userId, tenantId };
    if (type) filter.type = type;
    return this.scheduleModel.find(filter);
  }

  async findById(id: string, tenantId: string, type?: ScheduleType): Promise<Schedule> {
    const filter: Record<string, unknown> = { _id: id, tenantId };
    if (type) filter.type = type;
    const schedule = await this.scheduleModel.findOne(filter);
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
  }

  async update(id: string, tenantId: string, data: UpdateScheduleData, type?: ScheduleType): Promise<Schedule> {
    const schedule = await this.findById(id, tenantId, type);
    const { toneId, telegramBotId, aiConfig, imageConfig, ...rest } = data;
    Object.assign(schedule, rest);
    if (toneId !== undefined) {
      schedule.toneId = toneId ? new Types.ObjectId(toneId) : undefined;
    }
    if (telegramBotId !== undefined) {
      schedule.telegramBotId = telegramBotId ? new Types.ObjectId(telegramBotId) : undefined;
    }
    if (aiConfig !== undefined) {
      const existingAiKey = aiConfig.apiKey ? undefined : schedule.aiConfig?.apiKey;
      schedule.aiConfig = this.encryptAiConfig(aiConfig);
      if (schedule.aiConfig && existingAiKey) schedule.aiConfig.apiKey = existingAiKey;
    }
    if (imageConfig !== undefined) {
      const existingImgKey = imageConfig.apiKey ? undefined : schedule.imageConfig?.apiKey;
      schedule.imageConfig = this.encryptImageConfig(imageConfig);
      if (schedule.imageConfig && existingImgKey) schedule.imageConfig.apiKey = existingImgKey;
    }
    await schedule.save();
    this.stopCrons(id);
    if (schedule.isActive) this.registerCrons(schedule);
    return schedule;
  }

  async delete(id: string, tenantId: string, type?: ScheduleType): Promise<void> {
    const schedule = await this.findById(id, tenantId, type);
    this.stopCrons(id);
    await schedule.deleteOne();
  }

  async run(id: string, tenantId: string, type?: ScheduleType) {
    const schedule = await this.findById(id, tenantId, type);
    return this.executeSchedule(schedule);
  }

  private async executeSchedule(schedule: Schedule) {
    const executor = this.executors.find((e) => e.type === schedule.type);
    if (!executor) {
      this.logger.error(`No executor registered for schedule type "${schedule.type}"`);
      return { posted: false, channelResults: [] };
    }

    const runtimeConfig = this.buildRuntimeConfig(schedule.aiConfig);
    const result = await executor.execute(schedule, this.publisherMap, runtimeConfig);

    if (result.posted) {
      await this.scheduleModel.updateOne({ _id: schedule._id }, { lastRunAt: new Date() });
      const successCount = result.channelResults.filter((r) => r.success).length;
      this.logger.log(
        `Schedule ${schedule._id} (${schedule.name}): posted item ${result.itemId} to ${successCount}/${result.channelResults.length} channel(s)`,
      );
    } else {
      this.logger.debug(`Schedule ${schedule._id} (${schedule.name}): nothing to post`);
    }

    return result;
  }

  private nextFireTime(cronExpr: string): string {
    try {
      const job = CronJob.from({ cronTime: cronExpr, onTick: () => {}, start: false });
      return job.nextDate().toFormat('yyyy-MM-dd HH:mm:ss');
    } catch {
      return 'unknown';
    }
  }

  private registerCrons(schedule: Schedule): void {
    const id = schedule._id.toString();
    const registeredAt = new Date().toISOString();

    const tasks = schedule.times
      .map((cronExpr, i) => {
        if (!nodeCron.validate(cronExpr)) {
          this.logger.warn(
            `[Cron] SKIP  schedule="${schedule.name}" id=${id} type=${schedule.type} expr[${i}]="${cronExpr}" — invalid expression`,
          );
          return null;
        }
        const nextFire = this.nextFireTime(cronExpr);
        this.logger.log(
          `[Cron] REG   schedule="${schedule.name}" id=${id} type=${schedule.type} expr[${i}]="${cronExpr}" nextFire=${nextFire} registeredAt=${registeredAt}`,
        );
        return nodeCron.schedule(cronExpr, async () => {
          const firedAt = new Date().toISOString();
          this.logger.log(
            `[Cron] FIRE  schedule="${schedule.name}" id=${id} type=${schedule.type} expr="${cronExpr}" firedAt=${firedAt}`,
          );
          const fresh = await this.scheduleModel.findById(id);
          if (fresh?.isActive) {
            this.executeSchedule(fresh).catch((err) =>
              this.logger.error(`[Cron] ERROR schedule="${schedule.name}" id=${id} expr="${cronExpr}" error="${err.message}"`),
            );
          } else {
            this.logger.warn(`[Cron] SKIP  schedule="${schedule.name}" id=${id} — not active at fire time`);
          }
        });
      })
      .filter((t): t is nodeCron.ScheduledTask => t !== null);

    this.tasks.set(id, tasks);
    this.logger.log(
      `[Cron] DONE  schedule="${schedule.name}" id=${id} type=${schedule.type} registeredCount=${tasks.length}/${schedule.times.length}`,
    );
  }

  private stopCrons(scheduleId: string): void {
    const tasks = this.tasks.get(scheduleId);
    if (tasks) {
      tasks.forEach((t) => t.stop());
      this.tasks.delete(scheduleId);
      this.logger.log(`[Cron] STOP  id=${scheduleId} stoppedCount=${tasks.length} stoppedAt=${new Date().toISOString()}`);
    }
  }

  private encryptAiConfig(input?: AiConfigInput): ScheduleAiConfig | undefined {
    if (!input) return undefined;
    return {
      provider: input.provider,
      model: input.model,
      maxTokens: input.maxTokens,
      apiKey: input.apiKey ? this.encryptionService.encrypt(input.apiKey) : undefined,
    };
  }

  private encryptImageConfig(input?: ImageConfigInput): ScheduleImageConfig | undefined {
    if (!input) return undefined;
    return {
      enabled: input.enabled ?? false,
      customPrompt: input.customPrompt,
      size: input.size,
      quality: input.quality,
      style: input.style,
      apiKey: input.apiKey ? this.encryptionService.encrypt(input.apiKey) : undefined,
    };
  }

  private buildRuntimeConfig(aiConfig?: ScheduleAiConfig): ScheduleRuntimeConfig | undefined {
    if (!aiConfig) return undefined;
    return {
      aiProvider: aiConfig.provider,
      aiModel: aiConfig.model,
      aiMaxTokens: aiConfig.maxTokens,
      aiApiKey: aiConfig.apiKey ? this.encryptionService.decrypt(aiConfig.apiKey) : undefined,
    };
  }
}
