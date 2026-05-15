import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { SessionPoolService, PooledSession } from './session-pool.service';
import { EXTRACT_POST_SCRIPT, EXTRACT_PROFILE_SCRIPT } from './constants/instagram-scripts.constant';

export interface InstagramPostData {
    caption: string;
    mediaUrls: string[];
    author: string;
    pageTitle: string;
    metaTags: { name: string; content: string }[];
    isLoginWall?: boolean;
}

export interface InstagramProfilePostPreview {
    url: string;
    caption: string;
    type: 'reel' | 'post' | 'unknown';
    iconType: 'pinned' | 'reel' | 'image' | 'unknown';
}

@Injectable()
export class InstagramScraperService {
    constructor(private sessionPool: SessionPoolService) { }

    async scrapePost(url: string): Promise<InstagramPostData> {
        return this.withRetry(async (page) => {
            // networkidle lets Instagram's SSR meta tags fully populate
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

            const result = await page.evaluate(EXTRACT_POST_SCRIPT) as InstagramPostData & { isLoginWall?: boolean };

            if (result.isLoginWall) {
                throw new Error('login wall');
            }

            return result;
        });
    }

    async scrapeProfilePosts(profileUrl: string, limit: number): Promise<InstagramProfilePostPreview[]> {
        return this.withRetry(async (page) => {
            await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForSelector('article a[href*="/p/"], article a[href*="/reel/"]', { timeout: 10000 });
            const result = await page.evaluate(EXTRACT_PROFILE_SCRIPT(limit)) as InstagramProfilePostPreview[];
            return result;
        });
    }

    private async withRetry<T>(fn: (page: Page) => Promise<T>): Promise<T> {
        for (let attempt = 1; attempt <= 3; attempt++) {
            const session = this.sessionPool.acquire();
            if (!session) {
                await this.randomDelay(1000, 2000);
                continue;
            }
            const page = await session.context.newPage();
            await page.route('**/*', (route) => {
                const url = route.request().url();
                if (url.endsWith('.woff') || url.endsWith('.woff2') || url.endsWith('.mp4') || url.endsWith('.webm')) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            try {
                const result = await fn(page);
                session.requestCount++;
                this.sessionPool.release(session);
                return result;
            } catch (error) {
                if (error instanceof Error && (error.message.includes('login wall') || error.message.includes('checkpoint'))) {
                    this.sessionPool.invalidate(session);
                }
                this.sessionPool.release(session);
                if (attempt === 3) throw error;
                await this.randomDelay(2000, 5000);
            } finally {
                await page.close();
            }
        }
        throw new Error('All retry attempts failed');
    }

    private async randomDelay(min: number, max: number): Promise<void> {
        const delay = Math.random() * (max - min) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
}