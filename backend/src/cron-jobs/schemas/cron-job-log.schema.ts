import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LogStatus = 'success' | 'failed' | 'skipped';

@Schema({ timestamps: false })
export class CronJobLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'CronJob', required: true })
  jobId: Types.ObjectId;

  @Prop({ required: true, enum: ['success', 'failed', 'skipped'] })
  status: LogStatus;

  @Prop()
  statusCode?: number;

  @Prop({ maxlength: 1024 })
  responseBody?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ required: true })
  duration: number;

  @Prop({ default: 1 })
  attempt: number;

  @Prop({ type: Date, default: () => new Date() })
  executedAt: Date;
}

export const CronJobLogSchema = SchemaFactory.createForClass(CronJobLog);

CronJobLogSchema.index({ jobId: 1, executedAt: -1 });
