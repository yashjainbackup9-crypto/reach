import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  Logger,
  Headers,
  HttpCode,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { RegisterBotDto } from './dto/telegram.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Telegram')
@Controller('api/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  // ── Public webhook endpoint (called by Telegram, no auth) ─────────────────

  @Post('webhook/:botToken')
  @HttpCode(200)
  @ApiOperation({ summary: 'Telegram webhook receiver (called by Telegram)' })
  async handleWebhook(
    @Param('botToken') botToken: string,
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: any,
  ) {
    await this.telegramService.handleWebhookUpdate(botToken, secretHeader, update);
    return { ok: true };
  }

  @Post('bots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register or update a Telegram bot token' })
  async registerBot(@Request() req: any, @Body() dto: RegisterBotDto) {
    this.logger.debug(`POST /api/telegram/bots userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.telegramService.registerBot(req.user.userId, req.user.tenantId, dto);
    this.logger.debug(`POST /api/telegram/bots completed userId=${req.user.userId}`);
    return result;
  }

  @Get('bots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get registered Telegram bots' })
  async getBots(@Request() req: any) {
    this.logger.debug(`GET /api/telegram/bots userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.telegramService.getBots(req.user.userId, req.user.tenantId);
    this.logger.debug(`GET /api/telegram/bots completed count=${Array.isArray(result) ? result.length : '?'} userId=${req.user.userId}`);
    return result;
  }

  @Delete('bots/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a Telegram bot' })
  async deleteBot(@Request() req: any, @Param('id') id: string) {
    this.logger.debug(`DELETE /api/telegram/bots/${id} tenantId=${req.user.tenantId}`);
    const result = await this.telegramService.deleteBot(id, req.user.tenantId);
    this.logger.debug(`DELETE /api/telegram/bots/${id} completed tenantId=${req.user.tenantId}`);
    return result;
  }

}
