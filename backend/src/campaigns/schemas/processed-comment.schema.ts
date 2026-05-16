import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Stores every comment ID that has already been processed by a campaign,
 * preventing duplicate replies / DMs when the poller runs multiple times.
 *
 * Documents automatically expire after 30 days (TTL index on processedAt)
 * so the collection stays small.
 */
@Schema()
export class ProcessedComment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Campaign', required: true })
  campaignId: Types.ObjectId;

  /** Platform-native comment identifier */
  @Prop({ required: true })
  commentId: string;

  /** Platform-native user ID of the commenter (for DM routing) */
  @Prop()
  commenterId?: string;

  /** The keyword (if any) that matched this comment */
  @Prop()
  matchedKeyword?: string;

  /** Whether the public reply was successfully posted */
  @Prop({ default: false })
  replySent: boolean;

  /** Whether the private DM was successfully sent */
  @Prop({ default: false })
  dmSent: boolean;

  @Prop({ type: Date, default: () => new Date() })
  processedAt: Date;
}

export const ProcessedCommentSchema = SchemaFactory.createForClass(ProcessedComment);

// Unique guard: never process the same comment for the same campaign twice
ProcessedCommentSchema.index({ campaignId: 1, commentId: 1 }, { unique: true });

// TTL index: auto-delete documents 30 days after processedAt
ProcessedCommentSchema.index({ processedAt: 1 }, { expireAfterSeconds: 2_592_000 });
