import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type CronJobStatus = 'active' | 'paused' | 'completed' | 'failed';

@Schema({ _id: false })
export class LastResult {
  @Prop()
  statusCode?: number;

  @Prop()
  success: boolean;

  @Prop()
  error?: string;

  @Prop()
  duration: number;
}

export const LastResultSchema = SchemaFactory.createForClass(LastResult);

@Schema({ _id: false })
export class CreatedBy {
  @Prop({ required: true, enum: ['user', 'service'] })
  type: 'user' | 'service';

  @Prop({ required: true })
  id: string;

  @Prop()
  name?: string;
}

export const CreatedBySchema = SchemaFactory.createForClass(CreatedBy);

@Schema({ timestamps: true })
export class CronJob extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  baseUrl: string;

  @Prop({ required: true })
  endpoint: string;

  @Prop({ required: true, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' })
  method: HttpMethod;

  @Prop()
  headers?: string;

  @Prop({ type: Object })
  body?: Record<string, any>;

  @Prop({ required: true })
  cronExpression: string;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({ required: true, enum: ['active', 'paused', 'completed', 'failed'], default: 'active' })
  status: CronJobStatus;

  @Prop({ default: 3 })
  maxRetries: number;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ required: true })
  sourceService: string;

  @Prop()
  sourceReferenceId?: string;

  @Prop({ type: Date })
  lastExecutedAt?: Date;

  @Prop({ type: LastResultSchema })
  lastResult?: LastResult;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: Date })
  nextFireAt?: Date;

  @Prop({ type: CreatedBySchema, required: true })
  createdBy: CreatedBy;

  @Prop()
  tenantId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CronJobSchema = SchemaFactory.createForClass(CronJob);

CronJobSchema.index({ sourceService: 1, status: 1 });
CronJobSchema.index({ tenantId: 1 });
CronJobSchema.index({ sourceService: 1, sourceReferenceId: 1 });
CronJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
