import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as dotenv from 'dotenv';
import { LinkedInAccount } from '../accounts/schemas/linkedin-account.schema';
import { IPublisher, PostContent, PublishResult } from './provider.interface';

dotenv.config();

@Injectable()
export class LinkedInProvider implements IPublisher {
  readonly provider = 'linkedin';
  private readonly logger = new Logger(LinkedInProvider.name);
  private clientId = process.env.LINKEDIN_CLIENT_ID;
  private clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  private redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  constructor(
    @InjectModel('LinkedInAccount')
    private linkedinAccountModel: Model<LinkedInAccount>,
  ) {}

  // Message sent on Telegram
  // 
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      state: state,
      scope: 'w_member_social openid profile email',
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<any> {
    this.logger.debug(`Exchanging LinkedIn auth code for access token`);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri!,
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json() as Record<string, any>;

    if (!res.ok) {
      this.logger.error(`LinkedIn token exchange failed (${res.status}): ${JSON.stringify(data)}`);
      throw new Error(data['error_description'] || data['error'] || `Token exchange failed with status ${res.status}`);
    }

    this.logger.debug(`LinkedIn token exchange successful, expires_in=${data['expires_in']}`);
    return data;
  }

  async getUserProfile(accessToken: string): Promise<any> {
    this.logger.debug(`Fetching LinkedIn user profile via userinfo endpoint`);

    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`LinkedIn profile fetch failed (${res.status}): ${err}`);
      throw new Error(`Failed to fetch LinkedIn profile (${res.status}): ${err}`);
    }

    const data = await res.json() as Record<string, any>;
    this.logger.debug(`LinkedIn profile fetched: sub=${data['sub']} email=${data['email']}`);

    return {
      id: data['sub'],
      localizedFirstName: data['given_name'] ?? '',
      localizedLastName: data['family_name'] ?? '',
      email: data['email'],
      profileUrl: `https://www.linkedin.com/in/${data['sub']}`,
      picture: data['picture'],
    };
  }

  async connectAccount(
    userId: Types.ObjectId,
    tenantId: string,
    profileData: any,
    tokens: any,
  ) {
    const account = await this.linkedinAccountModel.findOneAndUpdate(
      { userId, tenantId },
      {
        userId,
        tenantId,
        accountId: profileData.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(
          Date.now() + tokens.expires_in * 1000,
        ),
        profileUrl: profileData.profileUrl,
        profileName: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
        isActive: true,
      },
      { upsert: true, new: true },
    );

    return account;
  }

  async getConnectedAccounts(userId: Types.ObjectId, tenantId: string) {
    return this.linkedinAccountModel.find({
      userId,
      tenantId,
      isActive: true,
    });
  }

  async disconnectAccount(accountId: string, tenantId: string) {
    return this.linkedinAccountModel.findByIdAndUpdate(
      accountId,
      { isActive: false },
      { new: true },
    );
  }

  private async uploadImage(accessToken: string, personUrn: string, imageBuffer: Buffer): Promise<string> {
    // Step 1: Register the image upload
    const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: personUrn,
          serviceRelationships: [
            { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
          ],
        },
      }),
    });

    if (!registerRes.ok) {
      const err = await registerRes.text();
      throw new Error(`LinkedIn image registration failed (${registerRes.status}): ${err}`);
    }

    const registerData = await registerRes.json() as Record<string, any>;
    const uploadMechanism = registerData['value']['uploadMechanism']['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
    const uploadUrl = uploadMechanism['uploadUrl'] as string;
    const linkedInHeaders: Record<string, string> = uploadMechanism['headers'] ?? {};
    const assetUrn = registerData['value']['asset'] as string;

    // Step 2: Upload the binary — forward the headers LinkedIn provided (e.g. media-type-family)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/png',
        ...linkedInHeaders,
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${err}`);
    }

    return assetUrn;
  }

  async postContent(
    accountId: string,
    tenantId: string,
    content: { text: string; imageDataUrl?: string },
  ): Promise<{ postId: string }> {
    const account = await this.linkedinAccountModel.findOne({
      _id: accountId,
      tenantId,
      isActive: true,
    });
    if (!account) {
      throw new NotFoundException(`LinkedIn account ${accountId} not found for tenant ${tenantId}`);
    }

    const personUrn = `urn:li:person:${account.accountId}`;
    let assetUrn: string | undefined;

    if (content.imageDataUrl) {
      const base64Data = content.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      this.logger.debug(`Uploading image to LinkedIn for account ${accountId}`);
      assetUrn = await this.uploadImage(account.accessToken, personUrn, imageBuffer);
      this.logger.debug(`LinkedIn image uploaded: asset=${assetUrn}`);
    }

    const shareContent = assetUrn
      ? {
          shareCommentary: { text: content.text },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              media: assetUrn,
            },
          ],
        }
      : {
          shareCommentary: { text: content.text },
          shareMediaCategory: 'NONE',
        };

    const body = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn post failed (${res.status}): ${err}`);
    }

    const postId =
      res.headers.get('x-restli-id') ??
      res.headers.get('location') ??
      'unknown';
    this.logger.log(`Posted to LinkedIn account ${accountId}: postId=${postId}`);
    return { postId };
  }

  async publish(accountId: string, tenantId: string, content: PostContent): Promise<PublishResult> {
    try {
      const result = await this.postContent(accountId, tenantId, { text: content.text, imageDataUrl: content.imageDataUrl });
      return { success: true, postId: result.postId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
