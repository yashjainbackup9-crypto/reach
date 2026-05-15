import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterBotDto {
  @ApiProperty({ description: 'Telegram bot token from @BotFather' })
  @IsString()
  @IsNotEmpty()
  botToken: string;
}

