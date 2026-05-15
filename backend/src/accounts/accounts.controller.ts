import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { LinkedInProvider } from '../providers/linkedin.provider';
import { InstagramProvider } from '../providers/instagram.provider';
import { FacebookProvider } from '../providers/facebook.provider';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@Controller('api/accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(
    private linkedinProvider: LinkedInProvider,
    private instagramProvider: InstagramProvider,
    private facebookProvider: FacebookProvider,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all connected accounts across all platforms' })
  async getAllAccounts(@Request() req: any) {
    this.logger.debug(`GET /api/accounts userId=${req.user.userId} tenantId=${req.user.tenantId}`);

    const [linkedin, instagram, facebook] = await Promise.all([
      this.linkedinProvider.getConnectedAccounts(req.user.userId, req.user.tenantId),
      this.instagramProvider.getConnectedAccounts(req.user.userId, req.user.tenantId),
      this.facebookProvider.getConnectedAccounts(req.user.userId, req.user.tenantId),
    ]);

    const result = [
      ...linkedin.map((account: any) => ({
        _id: account._id,
        platform: 'linkedin',
        profileName: account.profileName,
        profileUrl: account.profileUrl,
      })),
      ...instagram.map((account: any) => ({
        _id: account._id,
        platform: 'instagram',
        profileName: account.profileName || account.username,
        profileUrl: account.username ? `https://www.instagram.com/${account.username}/` : undefined,
        username: account.username,
        supportedPostTypes: account.supportedPostTypes,
      })),
      ...facebook.map((account: any) => ({
        _id: account._id,
        platform: 'facebook',
        profileName: account.profileName,
        profileUrl: `https://www.facebook.com/${account.accountId}`,
        username: account.username,
        supportedPostTypes: account.supportedPostTypes,
      })),
    ];

    this.logger.debug(`GET /api/accounts completed count=${result.length} userId=${req.user.userId}`);
    return result;
  }
}
