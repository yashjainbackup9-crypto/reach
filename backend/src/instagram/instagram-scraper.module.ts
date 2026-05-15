import { Module } from '@nestjs/common';
import { SessionPoolService } from './session-pool.service';
import { InstagramScraperService } from './instagram-scraper.service';

@Module({
    providers: [SessionPoolService, InstagramScraperService],
    exports: [SessionPoolService, InstagramScraperService],
})
export class InstagramScraperModule { }