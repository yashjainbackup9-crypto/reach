import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpMethod } from '../schemas/cron-job.schema';

export class CreateCronJobDto {
  @ApiProperty({ example: 'Weekly reminder email' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Sends payment reminder emails every Monday' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'https://tracktok.app' })
  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @ApiProperty({ example: '/api/cron/execute' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' })
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  @IsOptional()
  method?: HttpMethod;

  @ApiPropertyOptional({ example: { 'Content-Type': 'application/json' } })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ example: { action: 'send-reminder', reminderId: 'abc123' } })
  @IsObject()
  @IsOptional()
  body?: Record<string, any>;

  @ApiProperty({ example: '0 9 * * 1', description: 'Standard cron expression. Mutually exclusive with fireAt.' })
  @IsString()
  @IsNotEmpty()
  cronExpression: string;

  @ApiPropertyOptional({ example: '2026-07-20T15:30:00Z', description: 'One-time fire timestamp (ISO 8601). Mutually exclusive with cronExpression.' })
  @IsDateString()
  @IsOptional()
  fireAt?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', default: 'UTC' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'reminder_abc123' })
  @IsString()
  @IsOptional()
  sourceReferenceId?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
