import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TelegramBot extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true, unique: true })
  botToken: string;

  @Prop({ required: true })
  botUsername: string;

  @Prop()
  botName: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  lastUpdateId: number;

  @Prop({ type: String })
  webhookSecret: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TelegramBotSchema = SchemaFactory.createForClass(TelegramBot);
