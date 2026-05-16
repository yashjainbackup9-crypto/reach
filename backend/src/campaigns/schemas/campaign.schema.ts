import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignPlatform = 'instagram' | 'facebook';

@Schema({ timestamps: true })
export class Campaign extends Document {
  /** Owning user */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  /** Social platform this campaign targets */
  @Prop({ required: true, enum: ['instagram', 'facebook'] })
  platform: CampaignPlatform;

  /** MongoDB _id of the connected InstagramAccount / FacebookAccount doc */
  @Prop({ required: true })
  accountId: string;

  /** Platform-native account identifier (IG business account ID or FB page ID) */
  @Prop({ required: true })
  platformAccountId: string;

  /** Platform-native post / media ID */
  @Prop({ required: true })
  postId: string;

  /** Snapshot of the post caption for display purposes */
  @Prop()
  postCaption?: string;

  /** Public permalink of the post */
  @Prop()
  postPermalink?: string;

  /**
   * Case-insensitive keywords that trigger the auto-reply.
   * Empty array → every new comment on the post triggers.
   */
  @Prop({ type: [String], default: [] })
  keywords: string[];

  /**
   * Message posted as a public reply on the comment.
   * Supports {keyword} and {username} placeholders.
   * Default: "Hey @{username}, we've sent you a DM! 📩"
   */
  @Prop({ default: "Hey @{username}, we've sent you a DM! 📩" })
  publicReplyTemplate: string;

  /**
   * Message sent as a private direct message to the commenter.
   * Supports {keyword} and {username} placeholders.
   * Default: "Hey, here are the details you requested related to {keyword}."
   */
  @Prop({ default: 'Hey, here are the details you requested related to {keyword}.' })
  dmTemplate: string;

  /** Whether this campaign is actively polling for new comments */
  @Prop({ default: true })
  isActive: boolean;

  /** Timestamp of the last successful comment-poll (used as the cursor for new comments) */
  @Prop({ type: Date })
  lastCheckedAt?: Date;

  /** Running count of times the campaign was triggered */
  @Prop({ default: 0 })
  totalTriggered: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);

// Compound index: one campaign per (tenant, platform, post)
CampaignSchema.index({ tenantId: 1, platform: 1, postId: 1 });
CampaignSchema.index({ isActive: 1 });
