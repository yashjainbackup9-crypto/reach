import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Campaign, CampaignPlatform } from './schemas/campaign.schema';
import { ProcessedComment } from './schemas/processed-comment.schema';
import { InstagramAccount } from '../accounts/schemas/instagram-account.schema';
import { FacebookAccount } from '../accounts/schemas/facebook-account.schema';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

const FB_BASE = 'https://graph.facebook.com/v21.0';

// ─── Internal types ──────────────────────────────────────────────────────────

export interface PlatformPost {
  id: string;
  caption?: string;
  message?: string;
  permalink?: string;
  mediaType?: string;
  timestamp: string;
}

export interface PlatformComment {
  id: string;
  text: string;
  username?: string;
  commenterId?: string;
  timestamp: string;
}

export interface CommentProcessResult {
  commentId: string;
  matchedKeyword: string | null;
  replySent: boolean;
  dmSent: boolean;
  replyError?: string;
  dmError?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectModel('Campaign')
    private readonly campaignModel: Model<Campaign>,

    @InjectModel('ProcessedComment')
    private readonly processedCommentModel: Model<ProcessedComment>,

    @InjectModel('InstagramAccount')
    private readonly instagramAccountModel: Model<InstagramAccount>,

    @InjectModel('FacebookAccount')
    private readonly facebookAccountModel: Model<FacebookAccount>,
  ) {}

  // ─── Account token helpers ─────────────────────────────────────────────────

  private async getInstagramToken(
    accountId: string,
    tenantId: string,
  ): Promise<{ token: string; platformAccountId: string }> {
    const account = await this.instagramAccountModel.findOne({
      _id: accountId,
      tenantId,
      isActive: true,
    });
    if (!account) {
      throw new NotFoundException(`Instagram account ${accountId} not found`);
    }
    return { token: account.accessToken, platformAccountId: account.accountId };
  }

  private async getFacebookToken(
    accountId: string,
    tenantId: string,
  ): Promise<{ token: string; platformAccountId: string }> {
    const account = await this.facebookAccountModel.findOne({
      _id: accountId,
      tenantId,
      isActive: true,
    });
    if (!account) {
      throw new NotFoundException(`Facebook account ${accountId} not found`);
    }
    return { token: account.accessToken, platformAccountId: account.accountId };
  }

  // ─── Post listing ──────────────────────────────────────────────────────────

  /** List recent posts for an Instagram account (up to 50). */
  async listInstagramPosts(
    accountId: string,
    tenantId: string,
    limit = 20,
  ): Promise<PlatformPost[]> {
    const { token, platformAccountId } = await this.getInstagramToken(accountId, tenantId);
    const url =
      `${FB_BASE}/${platformAccountId}/media` +
      `?fields=id,caption,media_type,permalink,timestamp` +
      `&limit=${limit}` +
      `&access_token=${token}`;

    const res = await fetch(url);
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `Failed to fetch Instagram posts: ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }

    return ((data['data'] as any[]) ?? []).map((p) => ({
      id: p.id,
      caption: p.caption ?? '',
      mediaType: p.media_type,
      permalink: p.permalink,
      timestamp: p.timestamp,
    }));
  }

  /** List recent posts for a Facebook Page (up to 50). */
  async listFacebookPosts(
    accountId: string,
    tenantId: string,
    limit = 20,
  ): Promise<PlatformPost[]> {
    const { token, platformAccountId } = await this.getFacebookToken(accountId, tenantId);
    const url =
      `${FB_BASE}/${platformAccountId}/feed` +
      `?fields=id,message,created_time,permalink_url,full_picture` +
      `&limit=${limit}` +
      `&access_token=${token}`;

    const res = await fetch(url);
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `Failed to fetch Facebook posts: ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }

    return ((data['data'] as any[]) ?? []).map((p) => ({
      id: p.id,
      message: p.message ?? '',
      caption: p.message ?? '',
      permalink: p.permalink_url,
      timestamp: p.created_time,
    }));
  }

  /**
   * Search across all posts on an account.
   * The Meta Graph API does not expose full-text search on media/feed, so we
   * fetch the last `fetchLimit` posts and filter client-side.
   */
  async searchPosts(
    platform: CampaignPlatform,
    accountId: string,
    tenantId: string,
    query: string,
    fetchLimit = 50,
  ): Promise<PlatformPost[]> {
    const posts =
      platform === 'instagram'
        ? await this.listInstagramPosts(accountId, tenantId, fetchLimit)
        : await this.listFacebookPosts(accountId, tenantId, fetchLimit);

    const q = query.toLowerCase();
    return posts.filter(
      (p) =>
        (p.caption ?? '').toLowerCase().includes(q) ||
        (p.message ?? '').toLowerCase().includes(q) ||
        p.id.includes(query),
    );
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async create(
    userId: Types.ObjectId,
    tenantId: string,
    dto: CreateCampaignDto,
  ): Promise<Campaign> {
    const existing = await this.campaignModel.findOne({
      tenantId,
      platform: dto.platform,
      postId: dto.postId,
    });
    if (existing) {
      throw new ConflictException(
        `A campaign already exists for this post (id: ${existing._id}). Update or delete it instead.`,
      );
    }

    // Resolve the real platform user ID from the stored account document so we
    // never accidentally persist a MongoDB _id as the platformAccountId.
    let platformAccountId = dto.platformAccountId;
    if (dto.platform === 'instagram') {
      const igAccount = await this.instagramAccountModel.findOne({
        _id: dto.accountId,
        tenantId,
      });
      if (!igAccount) {
        throw new NotFoundException(`Instagram account ${dto.accountId} not found`);
      }
      platformAccountId = igAccount.accountId;
      this.logger.debug(`Resolved IG platformAccountId: dto had "${dto.platformAccountId}", using "${platformAccountId}"`);
    } else if (dto.platform === 'facebook') {
      const fbAccount = await this.facebookAccountModel.findOne({
        _id: dto.accountId,
        tenantId,
      });
      if (!fbAccount) {
        throw new NotFoundException(`Facebook account ${dto.accountId} not found`);
      }
      platformAccountId = fbAccount.accountId;
      this.logger.debug(`Resolved FB platformAccountId: dto had "${dto.platformAccountId}", using "${platformAccountId}"`);
    }

    const campaign = await this.campaignModel.create({
      userId,
      tenantId,
      platform: dto.platform,
      accountId: dto.accountId,
      platformAccountId,
      postId: dto.postId,
      postCaption: dto.postCaption,
      postPermalink: dto.postPermalink,
      keywords: (dto.keywords ?? []).map((k) => k.toLowerCase().trim()),
      publicReplyTemplate:
        dto.publicReplyTemplate ?? "Hey @{username}, we've sent you a DM! 📩",
      dmTemplate:
        dto.dmTemplate ??
        'Hey, here are the details you requested related to {keyword}.',
      isActive: true,
      lastCheckedAt: new Date(),
      totalTriggered: 0,
    });

    this.logger.log(
      `Campaign created: ${campaign._id} | platform=${dto.platform} | postId=${dto.postId} | tenantId=${tenantId}`,
    );
    return campaign;
  }

  async findAll(userId: Types.ObjectId, tenantId: string): Promise<Campaign[]> {
    return this.campaignModel.find({ userId, tenantId }).sort({ createdAt: -1 });
  }

  async findOne(id: string, tenantId: string): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({ _id: id, tenantId });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }
    return campaign;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const update: Partial<Campaign> = {};

    if (dto.postCaption !== undefined) update.postCaption = dto.postCaption;
    if (dto.postPermalink !== undefined) update.postPermalink = dto.postPermalink;
    if (dto.publicReplyTemplate !== undefined) update.publicReplyTemplate = dto.publicReplyTemplate;
    if (dto.dmTemplate !== undefined) update.dmTemplate = dto.dmTemplate;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.keywords !== undefined) {
      update.keywords = dto.keywords.map((k) => k.toLowerCase().trim());
    }

    const campaign = await this.campaignModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: update },
      { new: true },
    );
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }
    return campaign;
  }

  async addKeywords(id: string, tenantId: string, words: string[]): Promise<Campaign> {
    const normalised = words.map((k) => k.toLowerCase().trim());
    const campaign = await this.campaignModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $addToSet: { keywords: { $each: normalised } } },
      { new: true },
    );
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async removeKeywords(id: string, tenantId: string, words: string[]): Promise<Campaign> {
    const normalised = words.map((k) => k.toLowerCase().trim());
    const campaign = await this.campaignModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $pull: { keywords: { $in: normalised } } },
      { new: true },
    );
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async remove(id: string, tenantId: string): Promise<{ deleted: boolean }> {
    const result = await this.campaignModel.deleteOne({ _id: id, tenantId });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }
    await this.processedCommentModel.deleteMany({ campaignId: new Types.ObjectId(id) });
    return { deleted: true };
  }

  async getStats(id: string, tenantId: string) {
    const campaign = await this.findOne(id, tenantId);
    const totalProcessed = await this.processedCommentModel.countDocuments({
      campaignId: campaign._id,
    });
    const repliesSent = await this.processedCommentModel.countDocuments({
      campaignId: campaign._id,
      replySent: true,
    });
    const dmsSent = await this.processedCommentModel.countDocuments({
      campaignId: campaign._id,
      dmSent: true,
    });
    return { campaign, totalProcessed, repliesSent, dmsSent };
  }

  // ─── Comment polling & processing ─────────────────────────────────────────

  /** Called by the poller — processes all active campaigns. */
  async pollAllCampaigns(): Promise<void> {
    const campaigns = await this.campaignModel.find({ isActive: true });
    this.logger.debug(`Polling ${campaigns.length} active campaign(s)`);

    for (const campaign of campaigns) {
      try {
        await this.processCampaign(campaign);
      } catch (err: any) {
        this.logger.error(
          `Error processing campaign ${campaign._id}: ${err.message}`,
        );
      }
    }
  }

  async processCampaign(campaign: Campaign): Promise<CommentProcessResult[]> {
    this.logger.debug(
      `processCampaign start | campaign=${campaign._id} platform=${campaign.platform} ` +
        `accountId=${campaign.accountId} storedPlatformAccountId=${campaign.platformAccountId} postId=${campaign.postId}`,
    );

    // Always resolve token AND real platform account ID from the DB — never trust the
    // stored platformAccountId on the campaign document (may be a legacy MongoDB _id).
    let token: string;
    let resolvedPlatformAccountId: string;
    try {
      if (campaign.platform === 'instagram') {
        const acct = await this.instagramAccountModel.findOne({
          _id: campaign.accountId,
          isActive: true,
        });
        if (!acct) {
          this.logger.warn(`Instagram account ${campaign.accountId} not found for campaign ${campaign._id}`);
          return [];
        }
        // Use page access token for private_replies; fall back to user token if not yet stored
        token = acct.pageAccessToken || acct.accessToken;
        resolvedPlatformAccountId = acct.accountId;
        this.logger.debug(
          `Resolved IG account | mongoId=${acct._id} igUserId=${acct.accountId} username=${acct.username} ` +
            `tokenType=${acct.pageAccessToken ? 'page' : 'user (reconnect required)'}`,
        );
      } else {
        const acct = await this.facebookAccountModel.findOne({
          _id: campaign.accountId,
          isActive: true,
        });
        if (!acct) {
          this.logger.warn(`Facebook account ${campaign.accountId} not found for campaign ${campaign._id}`);
          return [];
        }
        token = acct.accessToken;
        resolvedPlatformAccountId = acct.accountId;
        this.logger.debug(
          `Resolved FB account | mongoId=${acct._id} pageId=${acct.accountId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to resolve account for campaign ${campaign._id}: ${err.message}`);
      return [];
    }

    // Silently patch the campaign if it still carries a stale platformAccountId
    if (campaign.platformAccountId !== resolvedPlatformAccountId) {
      this.logger.warn(
        `Patching stale platformAccountId on campaign ${campaign._id}: ` +
          `"${campaign.platformAccountId}" → "${resolvedPlatformAccountId}"`,
      );
      await this.campaignModel.updateOne(
        { _id: campaign._id },
        { $set: { platformAccountId: resolvedPlatformAccountId } },
      );
    }

    // Fetch comments newer than lastCheckedAt
    const since = campaign.lastCheckedAt ?? new Date(0);
    this.logger.debug(`Fetching comments since ${since.toISOString()} for post ${campaign.postId}`);

    const comments =
      campaign.platform === 'instagram'
        ? await this.fetchInstagramComments(campaign.postId, token, since)
        : await this.fetchFacebookComments(campaign.postId, token, since);

    this.logger.debug(`Fetched ${comments.length} new comment(s) for campaign ${campaign._id}`);

    // Update lastCheckedAt immediately so we don't re-fetch the same window on error
    await this.campaignModel.updateOne(
      { _id: campaign._id },
      { $set: { lastCheckedAt: new Date() } },
    );

    const results: CommentProcessResult[] = [];
    for (const comment of comments) {
      const result = await this.handleComment(campaign, comment, token);
      if (result) results.push(result);
    }

    if (results.length > 0) {
      await this.campaignModel.updateOne(
        { _id: campaign._id },
        { $inc: { totalTriggered: results.length } },
      );
      this.logger.log(`Campaign ${campaign._id} processed ${results.length} comment(s)`);
    }

    return results;
  }

  // ─── Platform-specific comment fetchers ───────────────────────────────────

  private async fetchInstagramComments(
    mediaId: string,
    token: string,
    since: Date,
  ): Promise<PlatformComment[]> {
    // Instagram Graph API returns all comments — we filter by timestamp client-side.
    // parent_id is included to detect and skip nested replies (private_replies only works on top-level comments).
    const url =
      `${FB_BASE}/${mediaId}/comments` +
      `?fields=id,text,username,timestamp,from,parent_id` +
      `&limit=100` +
      `&access_token=${token}`;

    this.logger.debug(`Fetching IG comments | mediaId=${mediaId} since=${since.toISOString()}`);
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `IG comments fetch failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }

    const raw: any[] = data['data'] ?? [];
    // Only process top-level comments — private_replies fails on nested replies
    const topLevel = raw.filter((c) => !c.parent_id);
    const afterSince = topLevel.filter((c) => new Date(c.timestamp) > since);
    this.logger.debug(
      `IG comments | total=${raw.length} top-level=${topLevel.length} after-since=${afterSince.length} mediaId=${mediaId}`,
    );

    return afterSince.map((c) => ({
      id: c.id,
      text: (c.text as string) ?? '',
      username: c.username ?? c.from?.username ?? 'unknown',
      commenterId: c.from?.id,
      timestamp: c.timestamp,
    }));
  }

  private async fetchFacebookComments(
    postId: string,
    token: string,
    since: Date,
  ): Promise<PlatformComment[]> {
    // Facebook supports a `since` Unix timestamp filter on the comments edge
    const sinceTs = Math.floor(since.getTime() / 1000);
    const url =
      `${FB_BASE}/${postId}/comments` +
      `?fields=id,message,from,created_time` +
      `&filter=stream` +
      `&since=${sinceTs}` +
      `&limit=100` +
      `&access_token=${token}`;

    const res = await fetch(url);
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `FB comments fetch failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }

    const raw: any[] = data['data'] ?? [];
    return raw
      .filter((c) => new Date(c.created_time) > since)
      .map((c) => ({
        id: c.id,
        text: (c.message as string) ?? '',
        username: c.from?.name ?? 'unknown',
        commenterId: c.from?.id,
        timestamp: c.created_time,
      }));
  }

  // ─── Comment handler ──────────────────────────────────────────────────────

  private async handleComment(
    campaign: Campaign,
    comment: PlatformComment,
    token: string,
  ): Promise<CommentProcessResult | null> {
    // De-duplicate: skip if already processed
    const alreadyDone = await this.processedCommentModel.exists({
      campaignId: campaign._id,
      commentId: comment.id,
    });
    if (alreadyDone) {
      this.logger.debug(`Comment ${comment.id} already processed — skipping`);
      return null;
    }

    // Keyword matching
    const matchedKeyword = this.matchKeyword(campaign.keywords, comment.text);
    const shouldTrigger = campaign.keywords.length === 0 || matchedKeyword !== null;
    if (!shouldTrigger) {
      this.logger.debug(`Comment ${comment.id} by @${comment.username} — no keyword match, skipping`);
      return null;
    }

    const keyword = matchedKeyword ?? '';
    const username = comment.username ?? 'there';

    this.logger.log(
      `Campaign ${campaign._id} triggered | comment=${comment.id} user=@${username} commenterId=${comment.commenterId ?? 'n/a'}` +
        (keyword ? ` keyword="${keyword}"` : ' (no-keyword campaign)'),
    );

    // Interpolate templates
    const publicReply = this.interpolate(campaign.publicReplyTemplate, { keyword, username });
    const dmText = this.interpolate(campaign.dmTemplate, { keyword, username });

    let replySent = false;
    let dmSent = false;
    let replyError: string | undefined;
    let dmError: string | undefined;

    // 1. Public reply
    try {
      this.logger.debug(`Posting public reply to comment ${comment.id}: "${publicReply}"`);
      if (campaign.platform === 'instagram') {
        await this.replyToInstagramComment(comment.id, token, publicReply);
      } else {
        await this.replyToFacebookComment(comment.id, token, publicReply);
      }
      replySent = true;
      this.logger.debug(`Public reply sent for comment ${comment.id}`);
    } catch (err: any) {
      replyError = err.message;
      this.logger.error(`Failed to post public reply for comment ${comment.id}: ${err.message}`);
    }

    // 2. Private DM
    try {
      if (campaign.platform === 'instagram') {
        this.logger.debug(`Sending IG private reply | commentId=${comment.id}`);
        await this.sendInstagramPrivateReply(comment.id, token, dmText);
      } else if (comment.commenterId) {
        this.logger.debug(`Sending FB DM | recipientId=${comment.commenterId}`);
        await this.sendFacebookDm(token, comment.commenterId, dmText);
      } else {
        throw new Error('Commenter ID not available — FB DM skipped');
      }
      dmSent = true;
      this.logger.debug(`Private message sent for comment ${comment.id}`);
    } catch (err: any) {
      dmError = err.message;
      this.logger.error(`Failed to send private message for comment ${comment.id}: ${err.message}`);
    }

    // Record in processed-comments (best-effort; unique index prevents duplicates)
    try {
      await this.processedCommentModel.create({
        campaignId: campaign._id,
        commentId: comment.id,
        commenterId: comment.commenterId,
        matchedKeyword: keyword || undefined,
        replySent,
        dmSent,
        processedAt: new Date(),
      });
    } catch {
      // Duplicate key — another pod already processed this comment, swallow the error
    }

    return {
      commentId: comment.id,
      matchedKeyword: keyword || null,
      replySent,
      dmSent,
      replyError,
      dmError,
    };
  }

  // ─── Keyword matching ─────────────────────────────────────────────────────

  private matchKeyword(keywords: string[], text: string): string | null {
    const lower = text.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return kw;
    }
    return null;
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }

  // ─── Instagram Graph API actions ──────────────────────────────────────────

  private async replyToInstagramComment(
    commentId: string,
    token: string,
    message: string,
  ): Promise<void> {
    const res = await fetch(`${FB_BASE}/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `IG reply failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }
  }

  /**
   * Send a private reply to an Instagram comment.
   * Uses /{comment-id}/private_replies which only requires instagram_manage_comments
   * and has no 24-hour messaging window restriction.
   * Endpoint: POST /v21.0/{comment-id}/private_replies
   */
  private async sendInstagramPrivateReply(
    commentId: string,
    token: string,
    text: string,
  ): Promise<void> {
    this.logger.debug(`POST ${FB_BASE}/${commentId}/private_replies`);
    const res = await fetch(`${FB_BASE}/${commentId}/private_replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, access_token: token }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      this.logger.error(
        `IG private reply failed | commentId=${commentId} status=${res.status} ` +
          `error=${data['error']?.message ?? JSON.stringify(data)}`,
      );
      throw new Error(
        `IG private reply failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }
    this.logger.debug(`IG private reply sent | commentId=${commentId} id=${data['id'] ?? 'n/a'}`);
  }

  // ─── Facebook Graph API actions ───────────────────────────────────────────

  private async replyToFacebookComment(
    commentId: string,
    token: string,
    message: string,
  ): Promise<void> {
    const res = await fetch(`${FB_BASE}/${commentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `FB comment reply failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }
  }

  /**
   * Send a private message via Facebook Messenger to a page fan/customer.
   * Requires pages_messaging permission on the page access token.
   * Endpoint: POST /v21.0/me/messages
   */
  private async sendFacebookDm(
    pageToken: string,
    recipientId: string,
    text: string,
  ): Promise<void> {
    const res = await fetch(`${FB_BASE}/me/messages?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    });
    const data = (await res.json()) as Record<string, any>;
    if (!res.ok) {
      throw new Error(
        `FB DM failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }
  }
}
