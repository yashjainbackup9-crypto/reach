import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface HistoryChannelResult {
  provider: string;
  accountId: string;
  success: boolean;
  error?: string;
}

@Schema({ timestamps: true })
export class PostHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ type: Types.ObjectId, ref: 'Schedule', required: true })
  scheduleId: Types.ObjectId;

  @Prop()
  queueItemId?: string;

  @Prop({ required: true })
  originalText: string;

  @Prop({ required: true })
  rewrittenText: string;

  @Prop()
  imageUrl?: string;

  @Prop({
    type: [{ provider: String, accountId: String, success: Boolean, error: String }],
    default: [],
  })
  channelResults: HistoryChannelResult[];

  @Prop({ type: Date, default: Date.now })
  postedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostHistorySchema = SchemaFactory.createForClass(PostHistory);
PostHistorySchema.index({ tenantId: 1, postedAt: -1 });
PostHistorySchema.index({ userId: 1, scheduleId: 1 });
