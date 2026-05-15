import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Tone extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  tone: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: String, enum: ['analyzed', 'generated', 'custom'], default: 'custom' })
  source: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ToneSchema = SchemaFactory.createForClass(Tone);
