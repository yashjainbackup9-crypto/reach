import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FacebookPostType = 'text' | 'image' | 'video';

@Schema({ timestamps: true })
export class FacebookAccount extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  accountId: string; // Facebook Page ID

  @Prop({ required: true })
  accessToken: string; // Page access token (preferably long-lived/never-expiring)

  @Prop({ type: Date })
  tokenExpiresAt: Date;

  @Prop()
  username: string; // Page handle or ID

  @Prop()
  profileName: string; // Page name

  @Prop()
  profilePictureUrl: string;

  @Prop({ type: [String], default: ['text', 'image', 'video'] })
  supportedPostTypes: FacebookPostType[];

  @Prop({ default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const FacebookAccountSchema = SchemaFactory.createForClass(FacebookAccount);
