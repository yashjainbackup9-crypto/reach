import { IsString, IsOptional, IsEnum, IsObject, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HttpMethod, CronJobStatus } from '../schemas/cron-job.schema';

export class UpdateCronJobDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endpoint?: string;

  @ApiPropertyOptional({ enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  @IsOptional()
  method?: HttpMethod;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  body?: Record<string, any>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cronExpression?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceReferenceId?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ enum: ['active', 'paused', 'completed', 'failed'] })
  @IsEnum(['active', 'paused', 'completed', 'failed'])
  @IsOptional()
  status?: CronJobStatus;
}
