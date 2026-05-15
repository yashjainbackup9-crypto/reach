import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScheduleType = 'text' | 'telegram-flow' | 'linkedin-flow' | 'content-flow';

export interface ChannelRef {
  provider: string;
  accountId: string;
}

export interface ScheduleAiConfig {
  provider?: string;
  model?: string;
  apiKey?: string; // AES-256-GCM encrypted
  maxTokens?: number;
}

export interface ScheduleImageConfig {
  enabled: boolean;
  customPrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  apiKey?: string; // AES-256-GCM encrypted
}

@Schema({ timestamps: true })
export class Schedule extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['text', 'telegram-flow', 'linkedin-flow', 'content-flow'] })
  type: ScheduleType;

  @Prop({ type: Types.ObjectId, ref: 'TelegramBot' })
  telegramBotId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tone' })
  toneId?: Types.ObjectId;

  @Prop({ type: [String], required: true })
  times: string[];

  @Prop({ type: [{ provider: String, accountId: String }], default: [] })
  channels: ChannelRef[];

  @Prop({
    type: {
      provider: { type: String },
      model: { type: String },
      apiKey: { type: String },
      maxTokens: { type: Number },
    },
    _id: false,
  })
  aiConfig?: ScheduleAiConfig;

  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      customPrompt: { type: String },
      size: { type: String },
      quality: { type: String },
      style: { type: String },
      apiKey: { type: String },
    },
    _id: false,
  })
  imageConfig?: ScheduleImageConfig;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  lastRunAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
