import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Request,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { InstagramProvider } from '../providers/instagram.provider';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiOperation, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Instagram Accounts')
@Controller('api/accounts/instagram')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InstagramAccountController {
  private readonly logger = new Logger(InstagramAccountController.name);

  constructor(private readonly instagramProvider: InstagramProvider) {}

  /**
   * Returns the Facebook OAuth dialog URL + a CSRF state token.
   * The client should open this URL in a popup (same as LinkedIn).
   * The user grants permissions on Facebook; Meta redirects to
   * INSTAGRAM_REDIRECT_URI with `code` and `state` query params.
   */
  @Get('auth-url')
  @ApiOperation({ summary: 'Get Facebook OAuth URL for connecting an Instagram Business/Creator account' })
  getAuthUrl() {
    this.logger.debug('GET /api/accounts/instagram/auth-url');
    const state = uuidv4();
    const authUrl = this.instagramProvider.getAuthorizationUrl(state);
    this.logger.debug(`Instagram auth-url generated state=${state}`);
    return { authUrl, state };
  }

  /**
   * Receives the OAuth code from the frontend callback page, exchanges it
   * for a long-lived token, discovers all linked Instagram accounts and saves them.
   */
  @Post('callback')
  @ApiOperation({ summary: 'Handle Facebook OAuth callback — connects all linked Instagram accounts' })
  async handleCallback(
    @Request() req: any,
    @Body() body: { code: string; state: string },
  ) {
    this.logger.debug(
      `POST /api/accounts/instagram/callback userId=${req.user.userId} state=${body.state}`,
    );
    const accounts = await this.instagramProvider.handleOAuthCallback(
      req.user.userId,
      req.user.tenantId,
      body.code,
    );
    this.logger.debug(
      `Instagram callback: connected ${accounts.length} account(s) for userId=${req.user.userId}`,
    );
    return {
      message: `${accounts.length} Instagram account${accounts.length !== 1 ? 's' : ''} connected successfully`,
      accounts,
    };
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List all connected Instagram accounts' })
  async getAccounts(@Request() req: any) {
    this.logger.debug(
      `GET /api/accounts/instagram/accounts userId=${req.user.userId} tenantId=${req.user.tenantId}`,
    );
    return this.instagramProvider.getConnectedAccounts(req.user.userId, req.user.tenantId);
  }

  @Delete('accounts/:accountId')
  @ApiOperation({ summary: 'Disconnect an Instagram account' })
  async disconnect(@Request() req: any, @Param('accountId') accountId: string) {
    this.logger.debug(
      `DELETE /api/accounts/instagram/accounts/${accountId} tenantId=${req.user.tenantId}`,
    );
    return this.instagramProvider.disconnectAccount(accountId, req.user.tenantId);
  }
}
