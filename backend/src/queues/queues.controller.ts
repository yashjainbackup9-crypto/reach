import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { AddQueueItemDto } from './dto/queue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Queues')
@Controller('api/queues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueuesController {
  private readonly logger = new Logger(QueuesController.name);

  constructor(private readonly queuesService: QueuesService) { }

  @Get()
  @ApiOperation({ summary: 'Get all queue items' })
  async getQueue(@Request() req: any) {
    this.logger.debug(`GET /api/queues userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.queuesService.getQueue(req.user.userId, req.user.tenantId);
    this.logger.debug(`GET /api/queues completed userId=${req.user.userId}`);
    return result;
  }

  @Post()
  @ApiOperation({ summary: 'Add item to queue' })
  async addItem(@Request() req: any, @Body() dto: AddQueueItemDto) {
    this.logger.debug(`POST /api/queues userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.queuesService.addItem(req.user.userId, req.user.tenantId, dto);
    this.logger.debug(`POST /api/queues completed userId=${req.user.userId}`);
    return result;
  }

  @Delete(':index')
  @ApiOperation({ summary: 'Remove item from queue by index' })
  async removeItem(@Request() req: any, @Param('index', ParseIntPipe) index: number) {
    this.logger.debug(`DELETE /api/queues/${index} userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.queuesService.removeItem(req.user.userId, req.user.tenantId, index);
    this.logger.debug(`DELETE /api/queues/${index} completed userId=${req.user.userId}`);
    return result;
  }

  @Post(':index/reprocess')
  @ApiOperation({ summary: 'Reprocess a failed queue item' })
  async reprocessItem(@Request() req: any, @Param('index', ParseIntPipe) index: number) {
    this.logger.debug(`POST /api/queues/${index}/reprocess userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.queuesService.reprocessItem(req.user.userId, req.user.tenantId, index);
    this.logger.debug(`POST /api/queues/${index}/reprocess completed userId=${req.user.userId}`);
    return result;
  }
}
