import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceApiKeysService } from './service-api-keys.service';
import { CreateServiceApiKeyDto } from './dto/create-service-api-key.dto';

@ApiTags('Service API Keys')
@ApiBearerAuth()
@Controller('api/service-api-keys')
@UseGuards(JwtAuthGuard)
export class ServiceApiKeysController {
  constructor(private readonly service: ServiceApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service API key (key shown once)' })
  async create(@Body() dto: CreateServiceApiKeyDto) {
    return this.service.create(dto.serviceName, dto.webhookSecret, dto.permissions);
  }

  @Get()
  @ApiOperation({ summary: 'List all service API keys' })
  async findAll() {
    return this.service.findAll();
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate API key (new key shown once)' })
  async regenerate(@Param('id') id: string) {
    return this.service.regenerate(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a service API key' })
  async deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
