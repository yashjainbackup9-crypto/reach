import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ImageConfigDto {
  @ApiPropertyOptional({ description: 'Enable AI image generation for posts in this schedule' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Additional context or style instructions for image generation' })
  @IsString()
  @IsOptional()
  customPrompt?: string;

  @ApiPropertyOptional({ description: 'Image dimensions', example: '1024x1024', enum: ['1024x1024', '1024x1536', '1536x1024'] })
  @IsString()
  @IsOptional()
  size?: string;

  @ApiPropertyOptional({ enum: ['auto', 'high', 'medium', 'low'], example: 'auto' })
  @IsString()
  @IsOptional()
  quality?: string;

  @ApiPropertyOptional({ enum: ['vivid', 'natural'], example: 'vivid' })
  @IsString()
  @IsOptional()
  style?: string;

  @ApiPropertyOptional({ description: 'OpenAI API key override for image generation (stored encrypted)' })
  @IsString()
  @IsOptional()
  apiKey?: string;
}
