import {
  Controller, Post, Get, Put, Delete,
  Body, Param, Request, UseGuards, Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { SchedulesService } from '../schedules.service';
import { CreateTelegramFlowDto, UpdateTelegramFlowDto } from './telegram-flow.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Schedules — Telegram Flow')
@Controller('api/schedules/telegram-flow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TelegramFlowController {
  private readonly logger = new Logger(TelegramFlowController.name);

  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a telegram-flow schedule — dequeues items and posts them via the specified Telegram bot' })
  async create(@Request() req: any, @Body() dto: CreateTelegramFlowDto) {
    this.logger.debug(`POST /api/schedules/telegram-flow name=${dto.name} userId=${req.user.userId}`);
    return this.schedulesService.create(req.user.userId, req.user.tenantId, {
      name: dto.name,
      type: 'telegram-flow',
      telegramBotId: dto.telegramBotId,
      toneId: dto.toneId,
      times: dto.times,
      aiConfig: dto.aiConfig,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all telegram-flow schedules for the current tenant' })
  async findAll(@Request() req: any) {
    return this.schedulesService.findAll(req.user.userId, req.user.tenantId, 'telegram-flow');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a telegram-flow schedule by ID' })
  @ApiParam({ name: 'id' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.findById(id, req.user.tenantId, 'telegram-flow');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a telegram-flow schedule — re-registers cron jobs when times or isActive changes' })
  @ApiParam({ name: 'id' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateTelegramFlowDto) {
    return this.schedulesService.update(id, req.user.tenantId, dto, 'telegram-flow');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a telegram-flow schedule and stop its cron jobs' })
  @ApiParam({ name: 'id' })
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.schedulesService.delete(id, req.user.tenantId, 'telegram-flow');
    return { message: 'Schedule deleted' };
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Manually trigger a telegram-flow schedule — dequeues the next ready item and posts it immediately' })
  @ApiParam({ name: 'id' })
  async run(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.run(id, req.user.tenantId, 'telegram-flow');
  }
}
