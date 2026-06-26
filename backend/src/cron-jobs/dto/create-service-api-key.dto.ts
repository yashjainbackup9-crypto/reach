import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceApiKeyDto {
  @ApiProperty({ example: 'tracktok' })
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @ApiPropertyOptional({ example: 'shared-webhook-secret-here' })
  @IsString()
  @IsOptional()
  webhookSecret?: string;

  @ApiPropertyOptional({ example: ['create', 'read', 'update', 'delete'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}
