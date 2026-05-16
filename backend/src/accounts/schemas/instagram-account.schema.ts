import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InstagramPostType = 'text' | 'image' | 'reel';

@Schema({ timestamps: true })
export class InstagramAccount extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  accountId: string; // Instagram Business/Creator Account ID (Page-backed)

  @Prop({ required: true })
  accessToken: string; // Long-lived user access token

  @Prop()
  pageAccessToken: string; // Facebook Page access token — required for private_replies

  @Prop()
  pageId: string; // Facebook Page ID linked to this IG business account

  @Prop({ type: Date })
  tokenExpiresAt: Date;

  @Prop()
  username: string; // Instagram handle, e.g. @mybrand

  @Prop()
  profileName: string; // Full display name

  @Prop()
  profilePictureUrl: string;

  @Prop({ type: [String], default: ['text', 'image', 'reel'] })
  supportedPostTypes: InstagramPostType[];

  @Prop({ default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InstagramAccountSchema = SchemaFactory.createForClass(InstagramAccount);
