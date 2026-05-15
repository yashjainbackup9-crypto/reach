import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class LinkedInAccount extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  accountId: string; // LinkedIn Account ID

  @Prop({ required: true })
  accessToken: string;

  @Prop()
  refreshToken: string;

  @Prop({ type: Date })
  tokenExpiresAt: Date;

  @Prop()
  profileUrl: string;

  @Prop()
  profileName: string;

  @Prop({ default: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LinkedInAccountSchema = SchemaFactory.createForClass(LinkedInAccount);
