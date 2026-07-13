import {
  Injectable, Logger, NotFoundException,
  OnModuleInit, OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as nodeCron from 'node-cron';
import { CronJob as CronJobCron } from 'cron';
import { CronJob } from './schemas/cron-job.schema';
import { CronJobLog } from './schemas/cron-job-log.schema';
import { EncryptionService } from '../common/encryption.service';
import { ServiceApiKeysService } from './service-api-keys.service';
import { CreateCronJobDto } from './dto/create-cron-job.dto';
import { UpdateCronJobDto } from './dto/update-cron-job.dto';

interface CronJobCreator {
  type: 'user' | 'service';
  id: string;
  name?: string;
  tenantId?: string;
  sourceService: string;
}

@Injectable()
export class CronJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronJobsService.name);
  private readonly tasks = new Map<string, nodeCron.ScheduledTask>();

  constructor(
    @InjectModel('CronJob') private readonly cronJobModel: Model<CronJob>,
    @InjectModel('CronJobLog') private readonly cronJobLogModel: Model<CronJobLog>,
    private readonly encryptionService: EncryptionService,
    private readonly serviceApiKeysService: ServiceApiKeysService,
  ) {}

  async onModuleInit() {
    const activeJobs = await this.cronJobModel.find({ status: 'active' }).exec();
    this.logger.log(`[CronJobs] Initializing ${activeJobs.length} active job(s)`);
    for (const job of activeJobs) {
      this.registerCron(job);
    }
  }

  onModuleDestroy() {
    this.logger.log(`[CronJobs] Shutting down ${this.tasks.size} job(s)`);
    for (const [id] of this.tasks) {
      this.stopCron(id);
    }
  }

  async create(dto: CreateCronJobDto, creator: CronJobCreator) {
    const encryptedHeaders = dto.headers
      ? this.encryptionService.encrypt(JSON.stringify(dto.headers))
      : undefined;

    const fireAtDate = dto.fireAt ? new Date(dto.fireAt) : undefined;
    const nextFireAt = fireAtDate || this.computeNextFire(dto.cronExpression);

    const doc = await this.cronJobModel.create({
      ...dto,
      headers: encryptedHeaders,
      method: dto.method || 'POST',
      timezone: dto.timezone || 'UTC',
      status: 'active',
      sourceService: creator.sourceService,
      createdBy: { type: creator.type, id: creator.id, name: creator.name },
      tenantId: creator.tenantId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      fireAt: fireAtDate,
      nextFireAt,
    });

    this.registerCron(doc);
    const jobType = fireAtDate ? 'one-time' : 'recurring';
    this.logger.log(`[CronJobs] Created job "${doc.name}" id=${doc._id} type=${jobType} nextFire=${nextFireAt?.toISOString()}`);
    return doc;
  }

  async update(id: string, dto: UpdateCronJobDto, requesterId?: string) {
    const job = await this.findOneOrFail(id);

    if (dto.headers) {
      (dto as any).headers = this.encryptionService.encrypt(JSON.stringify(dto.headers));
    }

    Object.assign(job, dto);

    if (dto.cronExpression) {
      job.nextFireAt = this.computeNextFire(dto.cronExpression);
    }

    await job.save();

    this.stopCron(id);
    if (job.status === 'active') {
      this.registerCron(job);
    }

    this.logger.log(`[CronJobs] Updated job "${job.name}" id=${id}`);
    return job;
  }

  async delete(id: string) {
    const job = await this.findOneOrFail(id);
    this.stopCron(id);
    await this.cronJobModel.deleteOne({ _id: id }).exec();
    this.logger.log(`[CronJobs] Deleted job "${job.name}" id=${id}`);
    return { deleted: true };
  }

  async pause(id: string) {
    const job = await this.findOneOrFail(id);
    job.status = 'paused';
    await job.save();
    this.stopCron(id);
    this.logger.log(`[CronJobs] Paused job "${job.name}" id=${id}`);
    return job;
  }

  async resume(id: string) {
    const job = await this.findOneOrFail(id);
    job.status = 'active';
    job.retryCount = 0;
    await job.save();
    this.registerCron(job);
    this.logger.log(`[CronJobs] Resumed job "${job.name}" id=${id}`);
    return job;
  }

  async trigger(id: string) {
    const job = await this.findOneOrFail(id);
    this.logger.log(`[CronJobs] Manual trigger job="${job.name}" id=${id}`);
    return this.executeCronJob(job);
  }

  async findAll(filter: { sourceService?: string; status?: string; tenantId?: string }) {
    const query: any = {};
    if (filter.sourceService) query.sourceService = filter.sourceService;
    if (filter.status) query.status = filter.status;
    if (filter.tenantId) query.tenantId = filter.tenantId;

    return this.cronJobModel
      .find(query)
      .select('-headers')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const job = await this.findOneOrFail(id);
    const logs = await this.cronJobLogModel
      .find({ jobId: new Types.ObjectId(id) })
      .sort({ executedAt: -1 })
      .limit(20)
      .exec();

    const jobObj = job.toObject();
    delete jobObj.headers;
    return { ...jobObj, recentLogs: logs };
  }

  async findBySourceReference(sourceService: string, sourceReferenceId: string) {
    return this.cronJobModel
      .findOne({ sourceService, sourceReferenceId })
      .exec();
  }

  // ── Private ──────────────────────────────────────────────────────────

  private registerCron(job: CronJob): void {
    const id = job._id.toString();

    // One-time job: schedule for fireAt timestamp
    if (job.fireAt) {
      const now = new Date();
      const fireTime = new Date(job.fireAt);
      const delayMs = fireTime.getTime() - now.getTime();

      if (delayMs <= 0) {
        this.logger.warn(`[CronJobs] SKIP job="${job.name}" id=${id} — fireAt is in the past`);
        return;
      }

      const timeoutId = setTimeout(async () => {
        this.logger.log(`[CronJobs] FIRE job="${job.name}" id=${id} type=one-time`);
        const fresh = await this.cronJobModel.findById(id).exec();
        if (fresh && fresh.status === 'active') {
          this.executeCronJob(fresh).catch((err) =>
            this.logger.error(`[CronJobs] ERROR job="${job.name}" id=${id}: ${err.message}`),
          );
        } else {
          this.logger.warn(`[CronJobs] SKIP job="${job.name}" id=${id} — not active at fire time`);
        }
        this.tasks.delete(id);
      }, delayMs);

      // Store timeout ID as a dummy task so it gets cleaned up on shutdown
      (this.tasks as any).set(id, { stop: () => clearTimeout(timeoutId) });
      this.logger.log(`[CronJobs] REG job="${job.name}" id=${id} type=one-time fireAt=${fireTime.toISOString()}`);
      return;
    }

    // Recurring job: use cron expression
    const expr = job.cronExpression;

    if (!nodeCron.validate(expr)) {
      this.logger.warn(`[CronJobs] SKIP job="${job.name}" id=${id} — invalid cron "${expr}"`);
      return;
    }

    const task = nodeCron.schedule(expr, async () => {
      this.logger.log(`[CronJobs] FIRE job="${job.name}" id=${id} expr="${expr}"`);
      const fresh = await this.cronJobModel.findById(id).exec();
      if (fresh && fresh.status === 'active') {
        this.executeCronJob(fresh).catch((err) =>
          this.logger.error(`[CronJobs] ERROR job="${job.name}" id=${id}: ${err.message}`),
        );
      } else {
        this.logger.warn(`[CronJobs] SKIP job="${job.name}" id=${id} — not active at fire time`);
      }
    }, { timezone: job.timezone || 'UTC' });

    this.tasks.set(id, task);
    this.logger.log(`[CronJobs] REG job="${job.name}" id=${id} type=recurring cron="${expr}" tz=${job.timezone || 'UTC'}`);
  }

  private stopCron(jobId: string): void {
    const task = this.tasks.get(jobId);
    if (task) {
      task.stop();
      this.tasks.delete(jobId);
      this.logger.log(`[CronJobs] STOP id=${jobId}`);
    }
  }

  private async executeCronJob(job: CronJob) {
    const id = job._id.toString();
    const url = `${job.baseUrl}${job.endpoint}`;
    const startTime = Date.now();

    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (job.headers) {
      try {
        const decrypted = JSON.parse(this.encryptionService.decrypt(job.headers));
        headers = { ...headers, ...decrypted };
      } catch (e) {
        this.logger.warn(`[CronJobs] Failed to decrypt headers for job ${id}`);
      }
    }

    const webhookSecret = await this.serviceApiKeysService.getWebhookSecret(job.sourceService);
    if (webhookSecret) {
      headers['X-Webhook-Secret'] = webhookSecret;
    }

    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let success = false;
    let errorMessage: string | undefined;

    try {
      const fetchOptions: RequestInit = {
        method: job.method,
        headers,
      };

      if (job.body && job.method !== 'GET') {
        fetchOptions.body = JSON.stringify(job.body);
      }

      const response = await fetch(url, fetchOptions);
      statusCode = response.status;
      responseBody = await response.text();
      if (responseBody.length > 1024) responseBody = responseBody.substring(0, 1024);
      success = response.ok;

      if (!success) {
        errorMessage = `HTTP ${statusCode}: ${responseBody.substring(0, 200)}`;
      }
    } catch (err: any) {
      errorMessage = err.message;
      this.logger.error(`[CronJobs] FETCH ERROR job="${job.name}" id=${id}: ${err.message}`);
    }

    const duration = Date.now() - startTime;

    await this.cronJobLogModel.create({
      jobId: job._id,
      status: success ? 'success' : 'failed',
      statusCode,
      responseBody,
      errorMessage,
      duration,
      attempt: job.retryCount + 1,
    });

    const updateFields: any = {
      lastExecutedAt: new Date(),
      lastResult: { statusCode, success, error: errorMessage, duration },
    };

    if (success) {
      updateFields.retryCount = 0;
      // One-time jobs are marked 'completed' after successful execution
      if (job.fireAt) {
        updateFields.status = 'completed';
        this.stopCron(id);
      } else {
        updateFields.nextFireAt = this.computeNextFire(job.cronExpression);
      }
    } else {
      const newRetryCount = (job.retryCount || 0) + 1;
      updateFields.retryCount = newRetryCount;
      if (newRetryCount >= job.maxRetries) {
        updateFields.status = job.fireAt ? 'failed' : 'failed';
        this.stopCron(id);
        this.logger.warn(`[CronJobs] FAILED job="${job.name}" id=${id} — max retries (${job.maxRetries}) reached`);
      } else if (!job.fireAt) {
        updateFields.nextFireAt = this.computeNextFire(job.cronExpression);
      }
    }

    await this.cronJobModel.updateOne({ _id: job._id }, updateFields).exec();

    this.logger.log(
      `[CronJobs] EXEC job="${job.name}" id=${id} status=${success ? 'OK' : 'FAIL'} code=${statusCode} duration=${duration}ms`,
    );

    return { success, statusCode, duration, errorMessage };
  }

  private computeNextFire(cronExpr: string): Date | undefined {
    try {
      const cronJob = CronJobCron.from({ cronTime: cronExpr, onTick: () => {}, start: false });
      return cronJob.nextDate().toJSDate();
    } catch {
      return undefined;
    }
  }

  private async findOneOrFail(id: string): Promise<CronJob> {
    const job = await this.cronJobModel.findById(id).exec();
    if (!job) throw new NotFoundException(`Cron job ${id} not found`);
    return job;
  }
}
