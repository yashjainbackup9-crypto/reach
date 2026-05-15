import { Controller, Get, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostHistoryService } from './post-history.service';

@ApiTags('Post History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/post-history')
export class PostHistoryController {
  constructor(private readonly postHistoryService: PostHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'List post history for tenant' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(
    @Request() req: any,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.postHistoryService.findByTenant(req.user.tenantId, limit, offset);
  }

  @Get('schedule/:scheduleId')
  @ApiOperation({ summary: 'List post history for a specific schedule' })
  async listBySchedule(@Request() req: any, @Param('scheduleId') scheduleId: string) {
    return this.postHistoryService.findBySchedule(scheduleId, req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single post history entry' })
  async getOne(@Request() req: any, @Param('id') id: string) {
    return this.postHistoryService.findById(id, req.user.tenantId);
  }
}
