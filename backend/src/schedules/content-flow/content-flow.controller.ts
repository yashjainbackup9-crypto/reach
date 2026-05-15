import {
  Controller, Post, Get, Put, Delete,
  Body, Param, Request, UseGuards, Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { SchedulesService } from '../schedules.service';
import { CreateContentFlowDto, UpdateContentFlowDto } from './content-flow.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Schedules — Content Flow')
@Controller('api/schedules/content-flow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentFlowController {
  private readonly logger = new Logger(ContentFlowController.name);

  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a content-flow schedule — dequeues items and posts to all selected channels' })
  async create(@Request() req: any, @Body() dto: CreateContentFlowDto) {
    this.logger.debug(`POST /api/schedules/content-flow name=${dto.name} userId=${req.user.userId}`);
    return this.schedulesService.create(req.user.userId, req.user.tenantId, {
      name: dto.name,
      type: 'content-flow',
      channels: dto.channels,
      toneId: dto.toneId,
      times: dto.times,
      aiConfig: dto.aiConfig,
      imageConfig: dto.imageConfig,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all content-flow schedules for the current tenant' })
  async findAll(@Request() req: any) {
    return this.schedulesService.findAll(req.user.userId, req.user.tenantId, 'content-flow');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a content-flow schedule by ID' })
  @ApiParam({ name: 'id' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.findById(id, req.user.tenantId, 'content-flow');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a content-flow schedule' })
  @ApiParam({ name: 'id' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateContentFlowDto) {
    return this.schedulesService.update(id, req.user.tenantId, dto, 'content-flow');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a content-flow schedule and stop its cron jobs' })
  @ApiParam({ name: 'id' })
  async delete(@Request() req: any, @Param('id') id: string) {
    await this.schedulesService.delete(id, req.user.tenantId, 'content-flow');
    return { message: 'Schedule deleted' };
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Manually trigger a content-flow schedule' })
  @ApiParam({ name: 'id' })
  async run(@Request() req: any, @Param('id') id: string) {
    return this.schedulesService.run(id, req.user.tenantId, 'content-flow');
  }
}
