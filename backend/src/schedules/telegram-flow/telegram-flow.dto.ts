import {
  IsString, IsArray, IsOptional, IsBoolean,
  ArrayMinSize, IsNotEmpty, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiConfigDto } from '../dto/ai-config.dto';

export class CreateTelegramFlowDto {
  @ApiProperty({ example: 'Morning Telegram Posts' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Telegram bot ID that will send the posts',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  telegramBotId: string;

  @ApiPropertyOptional({
    description: 'Tone ID — if set, content is rewritten in this tone before posting',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsOptional()
  toneId?: string;

  @ApiProperty({
    type: [String],
    description: 'Cron expressions (5-field, e.g. "0 9 * * *" = 9 AM daily)',
    example: ['0 9 * * *', '0 18 * * *'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  times: string[];

  @ApiPropertyOptional({
    type: AiConfigDto,
    description: 'AI configuration — provider, model, API key, and max tokens for tone rewriting',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiConfigDto)
  aiConfig?: AiConfigDto;
}

export class UpdateTelegramFlowDto {
  @ApiPropertyOptional({ example: 'Evening Telegram Posts' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Telegram bot ID that will send the posts',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsOptional()
  telegramBotId?: string;

  @ApiPropertyOptional({
    description: 'Tone ID — if set, content is rewritten in this tone before posting',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsOptional()
  toneId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Cron expressions (5-field, e.g. "0 9 * * *" = 9 AM daily)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  times?: string[];

  @ApiPropertyOptional({ description: 'Enable or disable this schedule' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: AiConfigDto,
    description: 'AI configuration — provider, model, API key, and max tokens for tone rewriting',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiConfigDto)
  aiConfig?: AiConfigDto;
}
