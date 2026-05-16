import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { InstagramScraperService } from '../instagram/instagram-scraper.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

export type VideoTemplate = 'slideshow' | 'reel';

export interface VideoGenerationResult {
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  author: string;
  mediaUrls: string[];
  template: VideoTemplate;
}

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);
  private bundleLocation: string | null = null;

  constructor(
    private readonly instagramScraper: InstagramScraperService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async generateFromInstagramUrl(
    instagramUrl: string,
    template: VideoTemplate = 'slideshow',
  ): Promise<VideoGenerationResult> {
    this.logger.log(`Generating ${template} video for ${instagramUrl}`);

    const postData = await this.instagramScraper.scrapePost(instagramUrl);
    this.logger.debug(
      `Scraped post: author=${postData.author} mediaUrls=${postData.mediaUrls?.length ?? 0}`,
    );

    const serveUrl = await this.ensureBundle();

    const compositionId = template === 'reel' ? 'InstagramReel' : 'InstagramSlideshow';
    const inputProps = {
      caption: postData.caption ?? '',
      mediaUrls: postData.mediaUrls ?? [],
      author: postData.author ?? '',
      pageTitle: postData.pageTitle ?? '',
    };

    const compositions = await getCompositions(serveUrl, { inputProps });
    const composition = compositions.find((c) => c.id === compositionId);
    if (!composition) {
      throw new InternalServerErrorException(
        `Composition "${compositionId}" not found — ensure the Remotion bundle is built correctly`,
      );
    }

    const outputPath = path.join(os.tmpdir(), `remotion-${Date.now()}.mp4`);

    try {
      this.logger.log(`Rendering ${composition.durationInFrames} frames → ${outputPath}`);

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: await this.getChromiumOptions(),
        onProgress: ({ progress }) => {
          this.logger.debug(`Render progress: ${Math.round(progress * 100)}%`);
        },
      });

      this.logger.log(`Render complete, uploading to Cloudinary`);
      const videoUrl = await this.cloudinary.uploadVideo(outputPath);
      this.logger.log(`Video uploaded: ${videoUrl}`);

      return {
        videoUrl,
        caption: postData.caption ?? '',
        author: postData.author ?? '',
        mediaUrls: postData.mediaUrls ?? [],
        template,
      };
    } finally {
      await fs.unlink(outputPath).catch((err) =>
        this.logger.warn(`Could not delete temp file ${outputPath}: ${err.message}`),
      );
    }
  }

  private async ensureBundle(): Promise<string> {
    if (this.bundleLocation) return this.bundleLocation;

    const entryPoint = path.resolve(process.cwd(), 'src', 'remotion', 'index.tsx');
    this.logger.log(`Bundling Remotion entry point: ${entryPoint}`);

    this.bundleLocation = await bundle({
      entryPoint,
      onProgress: (pct) => {
        if (pct % 20 === 0) this.logger.debug(`Bundle progress: ${pct}%`);
      },
    });

    this.logger.log(`Bundle ready at: ${this.bundleLocation}`);
    return this.bundleLocation;
  }

  private async getChromiumOptions(): Promise<Record<string, unknown>> {
    try {
      const { chromium } = await import('playwright');
      const executablePath = chromium.executablePath();
      this.logger.debug(`Using Playwright Chromium: ${executablePath}`);
      return { executablePath };
    } catch {
      this.logger.debug('Playwright Chromium not found, letting Remotion detect Chrome');
      return {};
    }
  }
}
