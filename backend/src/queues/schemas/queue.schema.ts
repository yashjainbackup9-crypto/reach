import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ItemType = 'text' | 'instagram_link' | 'video' | 'image';
export type ItemSource = 'manual' | 'automated';
export type ItemStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'posted';

export interface QueueItem {
  id: string;
  type: ItemType;
  source: ItemSource;
  status: ItemStatus;
  text?: string;
  url?: string;
  caption?: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
  error?: string;
  addedAt: Date;
  processedAt?: Date;
  postedAt?: Date;
}

@Schema({ timestamps: true })
export class Queue extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ type: [Object], default: [] })
  items: QueueItem[];
}

export const QueueSchema = SchemaFactory.createForClass(Queue);
