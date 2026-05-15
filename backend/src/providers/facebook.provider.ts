import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as dotenv from 'dotenv';
import { FacebookAccount } from '../accounts/schemas/facebook-account.schema';
import { IPublisher, PostContent, PublishResult } from './provider.interface';

dotenv.config();

const FB_BASE = 'https://graph.facebook.com/v21.0';

@Injectable()
export class FacebookProvider implements IPublisher {
  readonly provider = 'facebook';
  private readonly logger = new Logger(FacebookProvider.name);

  private readonly appId = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID!;
  private readonly appSecret = process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET!;
  private readonly redirectUri = process.env.FACEBOOK_REDIRECT_URI!;

  constructor(
    @InjectModel('FacebookAccount')
    private readonly facebookAccountModel: Model<FacebookAccount>,
  ) {}

  // ─── OAuth helpers ────────────────────────────────────────────────────────

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list',
        'public_profile',
      ].join(','),
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async handleOAuthCallback(
    userId: Types.ObjectId,
    tenantId: string,
    code: string,
  ): Promise<FacebookAccount[]> {
    // Step 1: Short-lived token
    this.logger.debug(`Facebook OAuth: exchanging code for short-lived token`);
    const shortToken = await this.exchangeCodeForShortToken(code);

    // Step 2: Long-lived user token
    this.logger.debug(`Facebook OAuth: upgrading to long-lived token`);
    const { access_token: longUserToken, expires_in } = await this.getLongLivedToken(shortToken);
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

    // Step 3: Fetch Pages and their Page Access Tokens
    this.logger.debug(`Facebook OAuth: fetching Pages`);
    const pages = await this.fetchPages(longUserToken);

    if (!pages.length) {
      throw new Error('No Facebook Pages found for this account.');
    }

    // Step 4: Upsert each Page
    const saved: FacebookAccount[] = [];
    for (const page of pages) {
      const account = await this.facebookAccountModel.findOneAndUpdate(
        { userId, tenantId, accountId: page.id },
        {
          userId,
          tenantId,
          accountId: page.id,
          accessToken: page.access_token, // Page-specific access token
          tokenExpiresAt,
          username: page.id,
          profileName: page.name,
          profilePictureUrl: page.picture?.data?.url ?? '',
          supportedPostTypes: ['text', 'image', 'video'],
          isActive: true,
        },
        { upsert: true, new: true },
      );
      saved.push(account);
      this.logger.log(`Facebook Page connected: ${page.name} (userId=${userId})`);
    }

    return saved;
  }

  // ─── Account management ───────────────────────────────────────────────────

  async getConnectedAccounts(userId: Types.ObjectId, tenantId: string) {
    return this.facebookAccountModel.find({ userId, tenantId, isActive: true });
  }

  async disconnectAccount(accountId: string, tenantId: string) {
    return this.facebookAccountModel.findByIdAndUpdate(
      accountId,
      { isActive: false },
      { new: true },
    );
  }

  // ─── Publishing ───────────────────────────────────────────────────────────

  async publish(accountId: string, tenantId: string, content: PostContent): Promise<PublishResult> {
    try {
      const account = await this.facebookAccountModel.findOne({
        _id: accountId,
        tenantId,
        isActive: true,
      });
      if (!account) {
        throw new NotFoundException(`Facebook account ${accountId} not found`);
      }

      const pageId = account.accountId;
      const token = account.accessToken;

      const videoUrl = content.mediaUrls?.find(u => this.isVideoUrl(u));
      const imageUrl = content.mediaUrls?.find(u => this.isImageUrl(u));

      if (videoUrl) {
        return this.publishVideo(pageId, token, videoUrl, content.text);
      }

      if (imageUrl) {
        return this.publishPhoto(pageId, token, imageUrl, content.text);
      }

      // Text-only post
      return this.publishFeed(pageId, token, content.text);
    } catch (err: any) {
      this.logger.error(`Facebook publish error for ${accountId}: ${err.message}`);
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
    const res = await fetch(`${FB_BASE}/oauth/access_token?${params.toString()}`);
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`Token exchange failed: ${data.error?.message || JSON.stringify(data)}`);
    return data.access_token;
  }

  private async getLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortToken,
    });
    const res = await fetch(`${FB_BASE}/oauth/access_token?${params.toString()}`);
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`Long-lived token failed: ${data.error?.message || JSON.stringify(data)}`);
    return data;
  }

  private async fetchPages(userToken: string): Promise<any[]> {
    const res = await fetch(`${FB_BASE}/me/accounts?fields=id,name,access_token,picture&access_token=${userToken}`);
    const data = await res.json() as any;
    if (!res.ok) throw new Error(`Fetch pages failed: ${data.error?.message || JSON.stringify(data)}`);
    return data.data || [];
  }

  // ─── Posting internals ────────────────────────────────────────────────────

  private async publishFeed(pageId: string, token: string, message: string): Promise<PublishResult> {
    const res = await fetch(`${FB_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message || JSON.stringify(data) };
    return { success: true, postId: data.id };
  }

  private async publishPhoto(pageId: string, token: string, url: string, caption: string): Promise<PublishResult> {
    const res = await fetch(`${FB_BASE}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, caption, access_token: token }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message || JSON.stringify(data) };
    return { success: true, postId: data.id };
  }

  private async publishVideo(pageId: string, token: string, file_url: string, description: string): Promise<PublishResult> {
    const res = await fetch(`${FB_BASE}/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_url, description, access_token: token }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message || JSON.stringify(data) };
    return { success: true, postId: data.id };
  }

  private isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url);
  }

  private isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url) || url.includes('cloudinary.com');
  }
}
