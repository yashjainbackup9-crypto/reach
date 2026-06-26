import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ServiceApiKey extends Document {
  @Prop({ required: true, unique: true })
  serviceName: string;

  @Prop({ required: true })
  apiKeyHash: string;

  @Prop()
  webhookSecret?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: ['create', 'read', 'update', 'delete'] })
  permissions: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const ServiceApiKeySchema = SchemaFactory.createForClass(ServiceApiKey);
