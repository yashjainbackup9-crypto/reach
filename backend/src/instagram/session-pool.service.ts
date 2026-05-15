import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext } from 'playwright';
import { randomUserAgent } from './constants/user-agents.constant';

export interface PooledSession {
    id: string;
    context: BrowserContext;
    lastUsed: Date;
    requestCount: number;
    isLocked: boolean;
}

@Injectable()
export class SessionPoolService implements OnModuleInit, OnModuleDestroy {
    private browser: Browser;
    private sessions: PooledSession[] = [];
    private readonly MAX_REQUESTS = 30;
    private readonly TTL_MS = 20 * 60 * 1000; // 20 minutes
    private readonly POOL_SIZE = 3;

    async onModuleInit() {
        this.browser = await chromium.launch();
        for (let i = 0; i < this.POOL_SIZE; i++) {
            await this.createSession();
        }
    }

    async onModuleDestroy() {
        for (const session of this.sessions) {
            await session.context.close();
        }
        await this.browser.close();
    }

    private async createSession(): Promise<PooledSession> {
        const context = await this.browser.newContext({
            userAgent: randomUserAgent(),
        });
        await context.addInitScript(() => {
            // @ts-ignore
            Object.defineProperty(globalThis.navigator, 'webdriver', {
                get: () => undefined,
            });
        });
        const session: PooledSession = {
            id: Math.random().toString(36),
            context,
            lastUsed: new Date(),
            requestCount: 0,
            isLocked: false,
        };
        this.sessions.push(session);
        return session;
    }

    acquire(): PooledSession | null {
        this.recycleSessions();
        const available = this.sessions.filter(s => !s.isLocked).sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());
        if (available.length === 0) return null;
        const session = available[0];
        session.isLocked = true;
        session.lastUsed = new Date();
        return session;
    }

    release(session: PooledSession) {
        session.isLocked = false;
        session.lastUsed = new Date();
    }

    invalidate(session: PooledSession) {
        session.requestCount = this.MAX_REQUESTS + 1;
    }

    private async recycleSessions() {
        const now = Date.now();
        for (const session of this.sessions) {
            if (session.requestCount >= this.MAX_REQUESTS || now - session.lastUsed.getTime() > this.TTL_MS) {
                await session.context.close();
                this.sessions = this.sessions.filter(s => s !== session);
                await this.createSession();
            }
        }
    }
}