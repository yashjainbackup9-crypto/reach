import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(@Body() registerDto: RegisterDto) {
    this.logger.debug(`POST /api/auth/register email=${registerDto.email}`);
    const result = await this.authService.register(registerDto);
    this.logger.debug(`POST /api/auth/register completed for email=${registerDto.email}`);
    return result;
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(@Body() loginDto: LoginDto) {
    this.logger.debug(`POST /api/auth/login email=${loginDto.email}`);
    const result = await this.authService.login(loginDto);
    this.logger.debug(`POST /api/auth/login completed for email=${loginDto.email}`);
    return result;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@Request() req: any) {
    this.logger.debug(`GET /api/auth/profile userId=${req.user.userId}`);
    const result = await this.authService.validateUser(req.user.userId);
    this.logger.debug(`GET /api/auth/profile completed for userId=${req.user.userId}`);
    return result;
  }
}
