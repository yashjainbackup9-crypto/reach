import {
  IsString, IsArray, IsOptional, IsBoolean,
  ArrayMinSize, IsNotEmpty, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiConfigDto } from '../dto/ai-config.dto';
import { ImageConfigDto } from '../dto/image-config.dto';

export class ChannelRefDto {
  @ApiProperty({ example: 'telegram' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  accountId: string;
}

export class CreateContentFlowDto {
  @ApiProperty({ example: 'Daily Posts' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: [ChannelRefDto],
    description: 'Channels to publish to — provider is "telegram" or "linkedin", accountId is the bot/account ID',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelRefDto)
  channels: ChannelRefDto[];

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  toneId?: string;

  @ApiProperty({ type: [String], example: ['0 9 * * *'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  times: string[];

  @ApiPropertyOptional({ type: AiConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiConfigDto)
  aiConfig?: AiConfigDto;

  @ApiPropertyOptional({ type: ImageConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageConfigDto)
  imageConfig?: ImageConfigDto;
}

export class UpdateContentFlowDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ type: [ChannelRefDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelRefDto)
  @IsOptional()
  channels?: ChannelRefDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  toneId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  times?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: AiConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiConfigDto)
  aiConfig?: AiConfigDto;

  @ApiPropertyOptional({ type: ImageConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageConfigDto)
  imageConfig?: ImageConfigDto;
}
