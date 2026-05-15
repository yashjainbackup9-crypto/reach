import { IsString, IsOptional, IsNumber, IsIn, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AiConfigDto {
  @ApiPropertyOptional({
    enum: ['anthropic', 'openai', 'gemini'],
    description: 'AI provider to use for tone rewriting',
    example: 'anthropic',
  })
  @IsString()
  @IsIn(['anthropic', 'openai', 'gemini'])
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Model name override (e.g. "claude-sonnet-4-6", "gpt-4o", "gemini-3-flash-preview")',
    example: 'claude-sonnet-4-6',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({
    description: 'API key for the chosen provider — stored encrypted in the database',
    example: 'sk-ant-...',
  })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'Maximum tokens for the AI completion',
    example: 1024,
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  maxTokens?: number;
}
