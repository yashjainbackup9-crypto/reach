import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  AddKeywordsDto,
  RemoveKeywordsDto,
} from './dto/campaign.dto';

@ApiTags('Campaigns')
@Controller('api/campaigns')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CampaignsController {
  private readonly logger = new Logger(CampaignsController.name);

  constructor(private readonly campaignsService: CampaignsService) {}

  // ─── Post discovery ────────────────────────────────────────────────────────

  @Get('posts/instagram/:accountId')
  @ApiOperation({
    summary: 'List recent Instagram posts for an account',
    description:
      'Returns up to `limit` recent posts from the connected Instagram Business account. ' +
      'Use these post IDs when creating a campaign.',
  })
  @ApiParam({ name: 'accountId', description: 'MongoDB _id of the InstagramAccount document' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max posts to return (default 20, max 50)' })
  async listInstagramPosts(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.logger.debug(`GET /posts/instagram/${accountId} userId=${req.user.userId}`);
    const posts = await this.campaignsService.listInstagramPosts(
      accountId,
      req.user.tenantId,
      Math.min(limit, 50),
    );
    return { posts };
  }

  @Get('posts/facebook/:accountId')
  @ApiOperation({
    summary: 'List recent Facebook Page posts for an account',
    description:
      'Returns up to `limit` recent posts from the connected Facebook Page. ' +
      'Use these post IDs when creating a campaign.',
  })
  @ApiParam({ name: 'accountId', description: 'MongoDB _id of the FacebookAccount document' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max posts to return (default 20, max 50)' })
  async listFacebookPosts(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.logger.debug(`GET /posts/facebook/${accountId} userId=${req.user.userId}`);
    const posts = await this.campaignsService.listFacebookPosts(
      accountId,
      req.user.tenantId,
      Math.min(limit, 50),
    );
    return { posts };
  }

  @Get('posts/search')
  @ApiOperation({
    summary: 'Search posts across an account',
    description:
      'Fetches the latest posts and filters them client-side by caption / message text. ' +
      'The Meta Graph API does not offer full-text search, so this scans up to `fetchLimit` recent posts.',
  })
  @ApiQuery({ name: 'platform', enum: ['instagram', 'facebook'], required: true })
  @ApiQuery({ name: 'accountId', required: true, description: 'MongoDB _id of the account document' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'fetchLimit', required: false, type: Number, description: 'How many recent posts to scan (default 50)' })
  async searchPosts(
    @Request() req: any,
    @Query('platform') platform: 'instagram' | 'facebook',
    @Query('accountId') accountId: string,
    @Query('q') q: string,
    @Query('fetchLimit', new DefaultValuePipe(50), ParseIntPipe) fetchLimit: number,
  ) {
    this.logger.debug(`GET /posts/search platform=${platform} accountId=${accountId} q=${q}`);
    const posts = await this.campaignsService.searchPosts(
      platform,
      accountId,
      req.user.tenantId,
      q,
      Math.min(fetchLimit, 100),
    );
    return { posts };
  }

  // ─── Campaign CRUD ─────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create a comment-automation campaign on a post',
    description:
      'Attaches a campaign to a specific post. Only one campaign per post is allowed. ' +
      'Leave `keywords` empty to respond to every comment; add keywords to filter comments.',
  })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  @ApiResponse({ status: 409, description: 'A campaign already exists for this post' })
  async create(@Request() req: any, @Body() dto: CreateCampaignDto) {
    this.logger.debug(
      `POST /campaigns userId=${req.user.userId} platform=${dto.platform} postId=${dto.postId}`,
    );
    return this.campaignsService.create(
      new Types.ObjectId(req.user.userId),
      req.user.tenantId,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns for the authenticated user' })
  async findAll(@Request() req: any) {
    return this.campaignsService.findAll(
      new Types.ObjectId(req.user.userId),
      req.user.tenantId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single campaign' })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.findOne(id, req.user.tenantId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get processing statistics for a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async getStats(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.getStats(id, req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a campaign',
    description:
      'Update templates, keywords, or toggle isActive. ' +
      'Setting isActive=false pauses comment polling without deleting the campaign.',
  })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, req.user.tenantId, dto);
  }

  @Post(':id/keywords')
  @ApiOperation({ summary: 'Add keywords to a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async addKeywords(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AddKeywordsDto,
  ) {
    return this.campaignsService.addKeywords(id, req.user.tenantId, dto.keywords);
  }

  @Delete(':id/keywords')
  @ApiOperation({ summary: 'Remove keywords from a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async removeKeywords(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RemoveKeywordsDto,
  ) {
    return this.campaignsService.removeKeywords(id, req.user.tenantId, dto.keywords);
  }

  @Post(':id/poll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger a comment-polling cycle for a single campaign',
    description:
      'Useful for testing — runs the same logic as the background cron job but for one campaign only.',
  })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async manualPoll(@Request() req: any, @Param('id') id: string) {
    const campaign = await this.campaignsService.findOne(id, req.user.tenantId);
    const results = await this.campaignsService.processCampaign(campaign);
    return { triggered: results.length, results };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a campaign and all its processed-comment records',
  })
  @ApiParam({ name: 'id', description: 'Campaign MongoDB _id' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.remove(id, req.user.tenantId);
  }
}
