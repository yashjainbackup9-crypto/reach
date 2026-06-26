import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CronJobAuthGuard } from './guards/cron-job-auth.guard';
import { CronJobsService } from './cron-jobs.service';
import { CreateCronJobDto } from './dto/create-cron-job.dto';
import { UpdateCronJobDto } from './dto/update-cron-job.dto';

@ApiTags('Cron Jobs')
@ApiBearerAuth()
@ApiHeader({ name: 'X-API-Key', required: false, description: 'Service API key (alternative to Bearer token)' })
@Controller('api/cron-jobs')
@UseGuards(CronJobAuthGuard)
export class CronJobsController {
  constructor(private readonly cronJobsService: CronJobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new cron job' })
  async create(@Request() req: any, @Body() dto: CreateCronJobDto) {
    const creator = this.extractCreator(req);
    return this.cronJobsService.create(dto, creator);
  }

  @Get()
  @ApiOperation({ summary: 'List cron jobs' })
  async findAll(
    @Request() req: any,
    @Query('sourceService') sourceService?: string,
    @Query('status') status?: string,
  ) {
    const filter: any = {};
    if (sourceService) filter.sourceService = sourceService;
    if (status) filter.status = status;
    if (req.user?.tenantId) filter.tenantId = req.user.tenantId;
    if (req.service) filter.sourceService = filter.sourceService || req.service.serviceName;
    return this.cronJobsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cron job details with recent logs' })
  async findOne(@Param('id') id: string) {
    return this.cronJobsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a cron job' })
  async update(@Param('id') id: string, @Body() dto: UpdateCronJobDto) {
    return this.cronJobsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a cron job' })
  async delete(@Param('id') id: string) {
    return this.cronJobsService.delete(id);
  }

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually trigger a cron job' })
  async trigger(@Param('id') id: string) {
    return this.cronJobsService.trigger(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a cron job' })
  async pause(@Param('id') id: string) {
    return this.cronJobsService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused cron job' })
  async resume(@Param('id') id: string) {
    return this.cronJobsService.resume(id);
  }

  private extractCreator(req: any) {
    if (req.service) {
      return {
        type: 'service' as const,
        id: req.service.serviceId,
        name: req.service.serviceName,
        sourceService: req.service.serviceName,
      };
    }
    return {
      type: 'user' as const,
      id: req.user.userId,
      name: req.user.email,
      tenantId: req.user.tenantId,
      sourceService: 'reach',
    };
  }
}
