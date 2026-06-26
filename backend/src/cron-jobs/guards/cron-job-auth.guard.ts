import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from './api-key.guard';

@Injectable()
export class CronJobAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.headers['x-api-key']) {
      return this.apiKeyGuard.canActivate(context);
    }

    if (request.headers['authorization']) {
      return this.jwtAuthGuard.canActivate(context) as Promise<boolean>;
    }

    throw new UnauthorizedException('Provide either X-API-Key or Authorization Bearer token');
  }
}
