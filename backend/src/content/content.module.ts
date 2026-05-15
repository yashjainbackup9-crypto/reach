import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentController } from './content.controller';
import { ToneService } from './tone.service';
import { TonesService } from './tones.service';
import { ContentRewriterService } from './content-rewriter.service';
import { ImageGenerationService } from './image-generation.service';
import { WebResearchService } from './web-research.service';
import { Tone, ToneSchema } from './schemas/tone.schema';
import { InstagramScraperModule } from '../instagram/instagram-scraper.module';
import { AIProviderModule } from '../ai-provider/ai-provider.module';

@Module({
    imports: [
        AIProviderModule,
        InstagramScraperModule,
        MongooseModule.forFeature([{ name: Tone.name, schema: ToneSchema }]),
    ],
    controllers: [ContentController],
    providers: [ToneService, TonesService, ContentRewriterService, ImageGenerationService, WebResearchService],
    exports: [ToneService, TonesService, ContentRewriterService, ImageGenerationService, WebResearchService],
})
export class ContentModule { }
