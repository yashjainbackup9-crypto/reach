import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TelegramMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'TelegramBot', required: true })
  botId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  chatId: string;

  @Prop({ required: true })
  messageId: number;

  @Prop({ required: true })
  updateId: number;

  @Prop()
  text: string;

  @Prop()
  fromUsername: string;

  @Prop()
  fromFirstName: string;

  @Prop({ type: Date })
  sentAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TelegramMessageSchema = SchemaFactory.createForClass(TelegramMessage);

TelegramMessageSchema.index({ botId: 1, chatId: 1, messageId: 1 }, { unique: true });
