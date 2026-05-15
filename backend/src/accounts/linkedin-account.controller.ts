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
import { LinkedInProvider } from '../providers/linkedin.provider';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/accounts/linkedin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LinkedInAccountController {
  private readonly logger = new Logger(LinkedInAccountController.name);

  constructor(private linkedinProvider: LinkedInProvider) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get LinkedIn authorization URL' })
  getAuthUrl() {
    this.logger.debug('GET /api/accounts/linkedin/auth-url');
    const state = uuidv4();
    const result = {
      authUrl: this.linkedinProvider.getAuthorizationUrl(state),
      state,
    };
    this.logger.debug(`GET /api/accounts/linkedin/auth-url completed state=${state}`);
    return result;
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle LinkedIn OAuth callback' })
  async handleCallback(
    @Request() req: any,
    @Body() body: { code: string; state: string },
  ) {
    this.logger.debug(`POST /api/accounts/linkedin/callback userId=${req.user.userId} state=${body.state}`);
    const { code } = body;

    const tokens = await this.linkedinProvider.exchangeCodeForToken(code);
    this.logger.debug(`POST /api/accounts/linkedin/callback token exchanged userId=${req.user.userId}`);

    const profile = await this.linkedinProvider.getUserProfile(tokens.access_token);
    this.logger.debug(`POST /api/accounts/linkedin/callback profile fetched profileId=${profile.id}`);

    const account = await this.linkedinProvider.connectAccount(
      req.user.userId,
      req.user.tenantId,
      profile,
      tokens,
    );
    this.logger.debug(`POST /api/accounts/linkedin/callback account connected userId=${req.user.userId}`);

    return {
      message: 'LinkedIn account connected successfully',
      account,
    };
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Get all connected LinkedIn accounts' })
  async getAccounts(@Request() req: any) {
    this.logger.debug(`GET /api/accounts/linkedin/accounts userId=${req.user.userId} tenantId=${req.user.tenantId}`);
    const result = await this.linkedinProvider.getConnectedAccounts(
      req.user.userId,
      req.user.tenantId,
    );
    this.logger.debug(`GET /api/accounts/linkedin/accounts completed count=${result.length} userId=${req.user.userId}`);
    return result;
  }

  @Delete('accounts/:accountId')
  @ApiOperation({ summary: 'Disconnect a LinkedIn account' })
  async disconnectAccount(
    @Request() req: any,
    @Param('accountId') accountId: string,
  ) {
    this.logger.debug(`DELETE /api/accounts/linkedin/accounts/${accountId} tenantId=${req.user.tenantId}`);
    const result = await this.linkedinProvider.disconnectAccount(accountId, req.user.tenantId);
    this.logger.debug(`DELETE /api/accounts/linkedin/accounts/${accountId} completed tenantId=${req.user.tenantId}`);
    return result;
  }
}
