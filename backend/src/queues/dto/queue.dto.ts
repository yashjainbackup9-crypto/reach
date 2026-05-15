import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddQueueItemDto {
  @ApiProperty({ enum: ['text', 'instagram_link', 'video', 'image'] })
  @IsEnum(['text', 'instagram_link', 'video', 'image'])
  type: 'text' | 'instagram_link' | 'video' | 'image';

  @ApiPropertyOptional({ enum: ['manual', 'automated'] })
  @IsEnum(['manual', 'automated'])
  @IsOptional()
  source?: 'manual' | 'automated';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}
