import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  ArrayUnique,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Social platform',
    enum: ['instagram', 'facebook'],
    example: 'instagram',
  })
  @IsEnum(['instagram', 'facebook'])
  platform: 'instagram' | 'facebook';

  @ApiProperty({
    description: 'MongoDB _id of the connected InstagramAccount / FacebookAccount document',
    example: '665a1f2b3c4d5e6f78901234',
  })
  @IsMongoId()
  accountId: string;

  @ApiProperty({
    description: 'Platform-native account identifier (IG business account ID or FB page ID)',
    example: '17841400008460056',
  })
  @IsString()
  @IsNotEmpty()
  platformAccountId: string;

  @ApiProperty({
    description: 'Platform-native post or media ID',
    example: '18023456789012345',
  })
  @IsString()
  @IsNotEmpty()
  postId: string;

  @ApiPropertyOptional({
    description: 'Caption / title of the post (for display purposes)',
    example: 'Check out our new product! 🚀',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  postCaption?: string;

  @ApiPropertyOptional({
    description: 'Public permalink of the post',
    example: 'https://www.instagram.com/p/ABC123/',
  })
  @IsOptional()
  @IsString()
  postPermalink?: string;

  @ApiPropertyOptional({
    description:
      'Trigger keywords (case-insensitive). Leave empty to trigger on every comment.',
    type: [String],
    example: ['price', 'cost', 'how much'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  keywords?: string[];

  @ApiPropertyOptional({
    description:
      'Message posted as a public reply on the triggering comment. Supports {keyword} and {username} placeholders.',
    example: "Hey @{username}, we've sent you a DM! 📩",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  publicReplyTemplate?: string;

  @ApiPropertyOptional({
    description:
      'Message sent via private DM to the commenter. Supports {keyword} and {username} placeholders.',
    example: 'Hey, here are the details you requested related to {keyword}.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  dmTemplate?: string;
}

export class UpdateCampaignDto extends PartialType(
  OmitType(CreateCampaignDto, ['platform', 'accountId', 'platformAccountId', 'postId'] as const),
) {
  @ApiPropertyOptional({ description: 'Enable or disable this campaign' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddKeywordsDto {
  @ApiProperty({
    description: 'One or more keywords to add to the campaign',
    type: [String],
    example: ['price', 'cost'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  keywords: string[];
}

export class RemoveKeywordsDto {
  @ApiProperty({
    description: 'One or more keywords to remove from the campaign',
    type: [String],
    example: ['price'],
  })
  @IsArray()
  @IsString({ each: true })
  keywords: string[];
}
