import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as dotenv from 'dotenv';
import { InstagramAccount } from '../accounts/schemas/instagram-account.schema';
import { IPublisher, PostContent, PublishResult } from './provider.interface';

dotenv.config();

const FB_BASE = 'https://graph.facebook.com/v21.0';
const IG_BASE = 'https://graph.instagram.com/v21.0';

@Injectable()
export class InstagramProvider implements IPublisher {
  readonly provider = 'instagram';
  private readonly logger = new Logger(InstagramProvider.name);

  private readonly appId = process.env.INSTAGRAM_APP_ID!;
  private readonly appSecret = process.env.INSTAGRAM_APP_SECRET!;
  private readonly redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;

  constructor(
    @InjectModel('InstagramAccount')
    private readonly instagramAccountModel: Model<InstagramAccount>,
  ) {}

  // ─── OAuth helpers ────────────────────────────────────────────────────────

  /**
   * Returns the Facebook OAuth dialog URL.
   * The user must authorise the app on Facebook; Meta will then expose the
   * linked Instagram Business/Creator account via the Graph API.
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_comments',
        'pages_show_list',
        'pages_read_engagement',
      ].join(','),
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchanges a short-lived code for a long-lived user access token and then
   * discovers and saves all Instagram Business/Creator accounts the Facebook
   * user has linked to their Pages.
   */
  async handleOAuthCallback(
    userId: Types.ObjectId,
    tenantId: string,
    code: string,
  ): Promise<InstagramAccount[]> {
    // Step 1: Short-lived token
    this.logger.debug(`Instagram OAuth: exchanging code for short-lived token`);
    const shortToken = await this.exchangeCodeForShortToken(code);

    // Step 2: Long-lived user token (60 days)
    this.logger.debug(`Instagram OAuth: upgrading to long-lived token`);
    const { access_token: longToken, expires_in } = await this.getLongLivedToken(shortToken);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Step 3: Enumerate Facebook Pages → Instagram Business accounts
    this.logger.debug(`Instagram OAuth: fetching Facebook Pages`);
    const igAccounts = await this.fetchInstagramAccounts(longToken);

    if (!igAccounts.length) {
      throw new Error(
        'No Instagram Business or Creator accounts found linked to this Facebook account. ' +
        'Make sure your Instagram account is connected to a Facebook Page in Meta Business Suite.',
      );
    }

    // Step 4: Upsert each Instagram account
    const saved: InstagramAccount[] = [];
    for (const ig of igAccounts) {
      const account = await this.instagramAccountModel.findOneAndUpdate(
        { userId, tenantId, accountId: ig.id },
        {
          userId,
          tenantId,
          accountId: ig.id,
          accessToken: longToken, // long-lived user token
          pageAccessToken: ig.pageAccessToken, // page token — required for private_replies
          pageId: ig.pageId,
          tokenExpiresAt,
          username: ig.username ?? '',
          profileName: ig.name ?? ig.username ?? ig.id,
          profilePictureUrl: ig.profile_picture_url ?? '',
          supportedPostTypes: ['text', 'image', 'reel'],
          isActive: true,
        },
        { upsert: true, new: true },
      );
      saved.push(account);
      this.logger.log(`Instagram account connected: ${ig.username ?? ig.id} (userId=${userId})`);
    }

    return saved;
  }

  // ─── Account management ───────────────────────────────────────────────────

  async getConnectedAccounts(userId: Types.ObjectId, tenantId: string) {
    return this.instagramAccountModel.find({ userId, tenantId, isActive: true });
  }

  async disconnectAccount(accountId: string, tenantId: string) {
    return this.instagramAccountModel.findByIdAndUpdate(
      accountId,
      { isActive: false },
      { new: true },
    );
  }

  // ─── Publishing ───────────────────────────────────────────────────────────

  async publish(accountId: string, tenantId: string, content: PostContent): Promise<PublishResult> {
    try {
      const account = await this.instagramAccountModel.findOne({
        _id: accountId,
        tenantId,
        isActive: true,
      });
      if (!account) {
        throw new NotFoundException(
          `Instagram account ${accountId} not found for tenant ${tenantId}`,
        );
      }

      const igId = account.accountId;
      const token = account.accessToken;

      const videoUrl = content.mediaUrls?.find(u => this.isVideoUrl(u));
      const imageUrl = content.mediaUrls?.find(u => this.isImageUrl(u));

      if (videoUrl) {
        const postId = await this.publishReel(igId, token, videoUrl, content.text);
        this.logger.log(`Instagram reel posted: accountId=${accountId} postId=${postId}`);
        return { success: true, postId };
      }

      if (imageUrl) {
        const postId = await this.publishImage(igId, token, imageUrl, content.text);
        this.logger.log(`Instagram image posted: accountId=${accountId} postId=${postId}`);
        return { success: true, postId };
      }

      if (content.imageDataUrl) {
        throw new Error(
          'Instagram requires a publicly accessible image URL (e.g. Cloudinary). ' +
          'Enable AI image generation with Cloudinary in your schedule, or ensure queue items have a hosted image URL.',
        );
      }

      // Text-only: Instagram Graph API does not support text-only posts
      this.logger.warn(
        `Instagram account ${accountId}: text-only post skipped — ` +
        `Instagram requires an image or video. Enable AI image generation on the schedule.`,
      );
      return {
        success: false,
        error:
          'Instagram does not support text-only posts. Attach an image or enable AI image generation.',
      };
    } catch (err: any) {
      this.logger.error(`Instagram publish error for ${accountId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── OAuth internals ──────────────────────────────────────────────────────

  private async exchangeCodeForShortToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const res = await fetch(`${FB_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json() as Record<string, any>;
    if (!res.ok || !data['access_token']) {
      throw new Error(
        `Facebook token exchange failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }
    return data['access_token'] as string;
  }

  private async getLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in: number }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortToken,
    });
    const res = await fetch(`${FB_BASE}/oauth/access_token?${params.toString()}`);
    const data = await res.json() as Record<string, any>;
    if (!res.ok || !data['access_token']) {
      throw new Error(
        `Facebook long-lived token exchange failed (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }
    return {
      access_token: data['access_token'] as string,
      expires_in: (data['expires_in'] as number) ?? 5184000, // 60 days default
    };
  }

  /**
   * Fetches all Facebook Pages managed by the user and returns the linked
   * Instagram Business/Creator accounts.
   */
  private async fetchInstagramAccounts(userToken: string): Promise<Array<{
    id: string;
    pageId: string;
    pageAccessToken: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  }>> {
    const url =
      `${FB_BASE}/me/accounts` +
      `?fields=id,name,access_token,instagram_business_account` +
      `&access_token=${userToken}`;
    const res = await fetch(url);
    const data = await res.json() as Record<string, any>;

    if (!res.ok) {
      throw new Error(
        `Failed to fetch Facebook Pages (${res.status}): ${data['error']?.message ?? JSON.stringify(data)}`,
      );
    }

    const pages: any[] = data['data'] ?? [];
    const igAccounts: Array<{ id: string; pageId: string; pageAccessToken: string; username?: string; name?: string; profile_picture_url?: string }> = [];

    for (const page of pages) {
      const igId = page['instagram_business_account']?.id;
      if (!igId) continue;

      const pageToken: string = page['access_token'] ?? userToken;

      // Fetch Instagram account details using the page access token
      const igRes = await fetch(
        `${FB_BASE}/${igId}?fields=id,username,name,profile_picture_url&access_token=${pageToken}`,
      );
      if (!igRes.ok) {
        this.logger.warn(`Could not fetch IG details for id=${igId}: ${igRes.status}`);
        igAccounts.push({ id: igId, pageId: page['id'], pageAccessToken: pageToken });
        continue;
      }
      const igData = await igRes.json() as Record<string, any>;
      igAccounts.push({
        id: igId,
        pageId: page['id'],
        pageAccessToken: pageToken,
        username: igData['username'],
        name: igData['name'],
        profile_picture_url: igData['profile_picture_url'],
      });
    }

    return igAccounts;
  }

  // ─── Posting internals ────────────────────────────────────────────────────

  private async publishImage(
    igId: string,
    token: string,
    imageUrl: string,
    caption: string,
  ): Promise<string> {
    // Step 1: Create container
    const containerRes = await fetch(`${FB_BASE}/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    });
    const containerData = await containerRes.json() as Record<string, any>;
    if (!containerRes.ok || !containerData['id']) {
      throw new Error(`Instagram media container failed: ${JSON.stringify(containerData)}`);
    }
    return this.publishContainer(igId, token, containerData['id'] as string);
  }

  private async publishReel(
    igId: string,
    token: string,
    videoUrl: string,
    caption: string,
  ): Promise<string> {
    const containerRes = await fetch(`${FB_BASE}/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: token,
      }),
    });
    const containerData = await containerRes.json() as Record<string, any>;
    if (!containerRes.ok || !containerData['id']) {
      throw new Error(`Instagram reel container failed: ${JSON.stringify(containerData)}`);
    }
    const containerId = containerData['id'] as string;

    // Poll until the reel is processed
    await this.waitForContainer(containerId, token);
    return this.publishContainer(igId, token, containerId);
  }

  private async publishContainer(igId: string, token: string, containerId: string): Promise<string> {
    const res = await fetch(`${FB_BASE}/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const data = await res.json() as Record<string, any>;
    if (!res.ok || !data['id']) {
      throw new Error(`Instagram media publish failed: ${JSON.stringify(data)}`);
    }
    return data['id'] as string;
  }

  private async waitForContainer(
    containerId: string,
    token: string,
    maxWaitMs = 90000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(
        `${FB_BASE}/${containerId}?fields=status_code&access_token=${token}`,
      );
      const data = await res.json() as Record<string, any>;
      const status = data['status_code'];
      if (status === 'FINISHED') return;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new Error(`Instagram reel processing failed with status: ${status}`);
      }
      await new Promise(r => setTimeout(r, 4000));
    }
    throw new Error('Instagram reel processing timed out after 90s');
  }

  private isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url);
  }

  private isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url) || url.includes('cloudinary.com');
  }
}
