import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ServiceApiKey } from '../schemas/service-api-key.schema';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel('ServiceApiKey') private readonly apiKeyModel: Model<ServiceApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) throw new UnauthorizedException('Missing X-API-Key header');

    const keys = await this.apiKeyModel.find({ isActive: true }).exec();

    for (const key of keys) {
      const match = await bcrypt.compare(apiKey, key.apiKeyHash);
      if (match) {
        request.service = {
          serviceId: key._id.toString(),
          serviceName: key.serviceName,
          permissions: key.permissions,
        };
        return true;
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }
}
