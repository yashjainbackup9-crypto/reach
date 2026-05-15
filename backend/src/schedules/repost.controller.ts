import {
  Controller, Post, Param, Body, Request, UseGuards, Inject, NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IPublisher, PostContent } from '../providers';
import { PostHistoryService } from '../post-history/post-history.service';

class RepostChannelDto {
  @IsString() provider: string;
  @IsString() accountId: string;
}

class RepostDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepostChannelDto)
  channels: RepostChannelDto[];
}

@ApiTags('Post History')
@Controller('api/post-history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RepostController {
  constructor(
    private readonly postHistoryService: PostHistoryService,
    @Inject('SCHEDULE_PUBLISHERS') private readonly publishers: IPublisher[],
  ) {}

  @Post(':id/repost')
  @ApiOperation({ summary: 'Repost a history entry to specific channels' })
  @ApiParam({ name: 'id' })
  async repost(@Request() req: any, @Param('id') id: string, @Body() dto: RepostDto) {
    const entry = await this.postHistoryService.findById(id, req.user.tenantId);
    if (!entry) throw new NotFoundException('Post history entry not found');

    const publisherMap = new Map(this.publishers.map((p) => [p.provider, p]));

    const channelResults = await Promise.all(
      dto.channels.map(async (ch) => {
        const publisher = publisherMap.get(ch.provider);
        if (!publisher) {
          return { provider: ch.provider, accountId: ch.accountId, success: false, error: `No publisher for "${ch.provider}"` };
        }
        const content: PostContent = {
          text: entry.rewrittenText,
          ...(entry.imageUrl ? { mediaUrls: [entry.imageUrl] } : {}),
        };
        const result = await publisher.publish(ch.accountId, req.user.tenantId, content);
        return { provider: ch.provider, accountId: ch.accountId, ...result };
      }),
    );

    return { channelResults };
  }
}
