import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ServiceApiKey } from './schemas/service-api-key.schema';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class ServiceApiKeysService {
  constructor(
    @InjectModel('ServiceApiKey') private readonly apiKeyModel: Model<ServiceApiKey>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(serviceName: string, webhookSecret?: string, permissions?: string[]) {
    const existing = await this.apiKeyModel.findOne({ serviceName }).exec();
    if (existing) throw new ConflictException(`Service "${serviceName}" already exists`);

    const rawKey = `crn_${crypto.randomBytes(32).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(rawKey, 10);

    const doc = await this.apiKeyModel.create({
      serviceName,
      apiKeyHash,
      webhookSecret: webhookSecret ? this.encryptionService.encrypt(webhookSecret) : undefined,
      permissions: permissions || ['create', 'read', 'update', 'delete'],
    });

    return { id: doc._id, serviceName: doc.serviceName, apiKey: rawKey };
  }

  async findAll() {
    return this.apiKeyModel
      .find()
      .select('-apiKeyHash -webhookSecret')
      .sort({ createdAt: -1 })
      .exec();
  }

  async regenerate(id: string) {
    const doc = await this.apiKeyModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Service API key not found');

    const rawKey = `crn_${crypto.randomBytes(32).toString('hex')}`;
    doc.apiKeyHash = await bcrypt.hash(rawKey, 10);
    await doc.save();

    return { id: doc._id, serviceName: doc.serviceName, apiKey: rawKey };
  }

  async deactivate(id: string) {
    const doc = await this.apiKeyModel.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Service API key not found');
    return { id: doc._id, serviceName: doc.serviceName, isActive: false };
  }

  async getWebhookSecret(serviceName: string): Promise<string | null> {
    const doc = await this.apiKeyModel.findOne({ serviceName, isActive: true }).exec();
    if (!doc?.webhookSecret) return null;
    return this.encryptionService.decrypt(doc.webhookSecret);
  }
}
