import {
    Controller, Post, Get, Patch, Delete, Body, Param, Request, UseGuards, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiBody, ApiParam,
} from '@nestjs/swagger';
import { ToneService, ToneInputType, GeneratedTone, ContentRewrite } from './tone.service';
import { TonesService, UpdateToneDto } from './tones.service';
import { Tone } from './schemas/tone.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageGenerationService, ImageGenerationOptions } from './image-generation.service';
import { InstagramScraperService } from '../instagram/instagram-scraper.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class GenerateImageDto {
    @ApiPropertyOptional({ description: 'Custom prompt for image generation' })
    prompt?: string;

    @ApiPropertyOptional({ description: 'Instagram post URL — caption will be extracted to build the prompt' })
    instagramUrl?: string;

    @ApiPropertyOptional({ enum: ['1024x1024', '1024x1536', '1536x1024'], example: '1024x1024' })
    size?: string;

    @ApiPropertyOptional({ enum: ['auto', 'high', 'medium', 'low'], example: 'auto' })
    quality?: 'auto' | 'high' | 'medium' | 'low';

    @ApiPropertyOptional({ enum: ['vivid', 'natural'], example: 'vivid' })
    style?: 'vivid' | 'natural';

    @ApiPropertyOptional({ description: 'OpenAI API key override' })
    apiKey?: string;
}

class GenerateToneDto {
    @ApiProperty({ enum: ['instagram_link', 'text'], example: 'instagram_link' })
    type: ToneInputType;

    @ApiProperty({
        description: 'Instagram post URL (for instagram_link) or descriptive text (for text)',
        example: 'https://www.instagram.com/p/abc123/',
    })
    input: string;

    @ApiProperty({ description: 'Name to save this tone under', example: 'My Coffee Brand Voice' })
    name: string;
}

class RewriteContentDto {
    @ApiProperty({ example: 'Our product is the best on the market.' })
    content: string;

    @ApiProperty({ description: 'Name of a previously generated and saved tone', example: 'My Coffee Brand Voice' })
    toneName: string;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

class GenerateToneResponse {
    @ApiProperty() tonePrompt: string;
    @ApiProperty() label: string;
    @ApiProperty({ enum: ['instagram_link', 'text'] }) source: ToneInputType;
    @ApiPropertyOptional() caption?: string;
    @ApiProperty() saved: Tone;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Content')
@Controller('api/content')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
    private readonly logger = new Logger(ContentController.name);

    constructor(
        private readonly toneService: ToneService,
        private readonly tonesService: TonesService,
        private readonly imageGenerationService: ImageGenerationService,
        private readonly instagramScraperService: InstagramScraperService,
    ) { }

    @Post('generate-image')
    @ApiOperation({ summary: 'Generate an AI image using OpenAI gpt-image-1. Provide a custom prompt or an Instagram URL to auto-build the prompt from the post caption.' })
    @ApiBody({ type: GenerateImageDto })
    @ApiResponse({ status: 201, description: 'Base64 PNG image data URL' })
    async generateImage(@Request() req: any, @Body() dto: GenerateImageDto): Promise<{ imageDataUrl: string; revisedPrompt?: string; model: string; prompt: string }> {
        this.logger.debug(`POST /api/content/generate-image userId=${req.user.userId} hasInstagramUrl=${!!dto.instagramUrl}`);

        if (!dto.prompt && !dto.instagramUrl) {
            throw new BadRequestException('Provide either a prompt or an instagramUrl');
        }

        let prompt = dto.prompt?.trim() ?? '';

        if (dto.instagramUrl?.trim()) {
            const postData = await this.instagramScraperService.scrapePost(dto.instagramUrl.trim());
            prompt = this.imageGenerationService.buildPromptFromPost(
                { caption: postData.caption, author: postData.author, pageTitle: postData.pageTitle },
                dto.prompt,
            );
        }

        if (!prompt) {
            throw new BadRequestException('Could not build a prompt — provide a prompt or a valid Instagram URL with a caption');
        }

        const options: ImageGenerationOptions = {
            ...(dto.apiKey ? { apiKey: dto.apiKey } : {}),
            ...(dto.size ? { size: dto.size } : {}),
            ...(dto.quality ? { quality: dto.quality } : {}),
            ...(dto.style ? { style: dto.style } : {}),
        };

        const result = await this.imageGenerationService.generateImage(prompt, options);
        this.logger.debug(`POST /api/content/generate-image completed model=${result.model} userId=${req.user.userId}`);

        return { ...result, prompt };
    }

    @Post('generate-tone')
    @ApiOperation({
        summary: 'Generate a Tone Prompt from an Instagram post URL or a text description, then save it',
    })
    @ApiBody({ type: GenerateToneDto })
    @ApiResponse({ status: 201, description: 'Generated tone prompt and saved record', type: GenerateToneResponse })
    async generateTone(@Request() req: any, @Body() dto: GenerateToneDto): Promise<GenerateToneResponse> {
        this.logger.debug(`POST /api/content/generate-tone type=${dto.type} name=${dto.name} userId=${req.user.userId}`);
        if (!dto.type || !['instagram_link', 'text'].includes(dto.type)) {
            throw new BadRequestException('type must be "instagram_link" or "text"');
        }
        if (!dto.input?.trim()) {
            throw new BadRequestException('input is required');
        }
        if (!dto.name?.trim()) {
            throw new BadRequestException('name is required — it will be used to reference this tone in rewrite');
        }

        const generated: GeneratedTone = await this.toneService.generateTone(dto.input.trim(), dto.type);
        this.logger.debug(`POST /api/content/generate-tone tone generated label=${generated.label} userId=${req.user.userId}`);

        const saved = await this.tonesService.create(req.user.userId, req.user.tenantId, {
            name: dto.name.trim(),
            tone: generated.tonePrompt,
            description: dto.input.trim(),
            source: this.tonesService.sourceFromType(dto.type),
        });
        this.logger.debug(`POST /api/content/generate-tone tone saved id=${saved._id} userId=${req.user.userId}`);

        return {
            tonePrompt: generated.tonePrompt,
            label: generated.label,
            source: generated.source,
            caption: generated.caption,
            saved,
        };
    }

    @Post('rewrite')
    @ApiOperation({
        summary: 'Get rewrite context for content using a saved tone (identified by name)',
    })
    @ApiBody({ type: RewriteContentDto })
    @ApiResponse({ status: 200, description: 'Content with tone prompt for LLM rewriting', type: Object })
    async rewriteContent(@Request() req: any, @Body() dto: RewriteContentDto): Promise<ContentRewrite> {
        this.logger.debug(`POST /api/content/rewrite toneName=${dto.toneName} userId=${req.user.userId}`);
        if (!dto.toneName?.trim()) {
            throw new BadRequestException('toneName is required — generate a tone first via POST /api/content/generate-tone');
        }

        const savedTone = await this.tonesService.findByName(dto.toneName.trim(), req.user.userId, req.user.tenantId);
        if (!savedTone) {
            throw new NotFoundException(
                `No tone named "${dto.toneName}" found. Generate a tone first via POST /api/content/generate-tone`,
            );
        }
        this.logger.debug(`POST /api/content/rewrite tone found id=${savedTone._id} userId=${req.user.userId}`);

        const result = await this.toneService.rewriteWithTone(dto.content, savedTone.name, savedTone.tone);
        this.logger.debug(`POST /api/content/rewrite completed userId=${req.user.userId}`);
        return result;
    }

    // ── Saved Tone CRUD ────────────────────────────────────────────────────────

    @Post('tones')
    @ApiOperation({ summary: 'Manually save a tone profile' })
    async createTone(@Request() req: any, @Body() dto: any) {
        this.logger.debug(`POST /api/content/tones name=${dto.name} userId=${req.user.userId}`);
        if (!dto.name?.trim()) {
            throw new BadRequestException('name is required');
        }
        if (!dto.tone?.trim()) {
            throw new BadRequestException('tone (prompt) is required');
        }
        const result = await this.tonesService.create(req.user.userId, req.user.tenantId, dto);
        this.logger.debug(`POST /api/content/tones completed id=${result._id} userId=${req.user.userId}`);
        return result;
    }

    @Get('tones')
    @ApiOperation({ summary: 'List all saved tone profiles' })
    async getTones(@Request() req: any): Promise<Tone[]> {
        this.logger.debug(`GET /api/content/tones userId=${req.user.userId} tenantId=${req.user.tenantId}`);
        const result = await this.tonesService.findAll(req.user.userId, req.user.tenantId);
        this.logger.debug(`GET /api/content/tones completed count=${result.length} userId=${req.user.userId}`);
        return result;
    }

    @Get('tones/:id')
    @ApiOperation({ summary: 'Get a single saved tone profile by ID' })
    @ApiParam({ name: 'id', description: 'Tone profile ID' })
    async getTone(@Request() req: any, @Param('id') id: string): Promise<Tone> {
        this.logger.debug(`GET /api/content/tones/${id} userId=${req.user.userId}`);
        const tone = await this.tonesService.findById(id, req.user.userId, req.user.tenantId);
        if (!tone) throw new NotFoundException('Tone not found');
        return tone;
    }

    @Patch('tones/:id')
    @ApiOperation({ summary: 'Update a saved tone profile' })
    @ApiParam({ name: 'id', description: 'Tone profile ID' })
    async updateTone(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateToneDto): Promise<Tone> {
        this.logger.debug(`PATCH /api/content/tones/${id} userId=${req.user.userId}`);
        const result = await this.tonesService.update(id, req.user.userId, req.user.tenantId, dto);
        this.logger.debug(`PATCH /api/content/tones/${id} completed userId=${req.user.userId}`);
        return result;
    }

    @Delete('tones/:id')
    @ApiOperation({ summary: 'Delete a saved tone profile' })
    @ApiParam({ name: 'id', description: 'Tone profile ID' })
    async deleteTone(@Request() req: any, @Param('id') id: string) {
        this.logger.debug(`DELETE /api/content/tones/${id} userId=${req.user.userId}`);
        await this.tonesService.delete(id, req.user.userId, req.user.tenantId);
        this.logger.debug(`DELETE /api/content/tones/${id} completed userId=${req.user.userId}`);
        return { message: 'Tone deleted successfully' };
    }
}
