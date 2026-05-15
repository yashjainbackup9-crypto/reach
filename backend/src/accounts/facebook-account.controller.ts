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
import { FacebookProvider } from '../providers/facebook.provider';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiOperation, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Facebook Accounts')
@Controller('api/accounts/facebook')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FacebookAccountController {
  private readonly logger = new Logger(FacebookAccountController.name);

  constructor(private readonly facebookProvider: FacebookProvider) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Facebook OAuth URL for connecting Facebook Pages' })
  getAuthUrl() {
    this.logger.debug('GET /api/accounts/facebook/auth-url');
    const state = uuidv4();
    const authUrl = this.facebookProvider.getAuthorizationUrl(state);
    return { authUrl, state };
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle Facebook OAuth callback — connects all managed Facebook Pages' })
  async handleCallback(
    @Request() req: any,
    @Body() body: { code: string; state: string },
  ) {
    this.logger.debug(
      `POST /api/accounts/facebook/callback userId=${req.user.userId} state=${body.state}`,
    );
    const accounts = await this.facebookProvider.handleOAuthCallback(
      req.user.userId,
      req.user.tenantId,
      body.code,
    );
    return {
      message: `${accounts.length} Facebook Page${accounts.length !== 1 ? 's' : ''} connected successfully`,
      accounts,
    };
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List all connected Facebook Pages' })
  async getAccounts(@Request() req: any) {
    return this.facebookProvider.getConnectedAccounts(req.user.userId, req.user.tenantId);
  }

  @Delete('accounts/:accountId')
  @ApiOperation({ summary: 'Disconnect a Facebook Page' })
  async disconnect(@Request() req: any, @Param('accountId') accountId: string) {
    return this.facebookProvider.disconnectAccount(accountId, req.user.tenantId);
  }
}
