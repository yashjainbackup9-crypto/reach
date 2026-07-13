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
        await this.ensurePoolSize();
    }

    async onModuleDestroy() {
        for (let index = this.sessions.length - 1; index >= 0; index--) {
            const session = this.sessions[index];
            if (!session.context.isClosed()) {
                await session.context.close();
            }
        }
        this.sessions = [];
        if (this.browser?.isConnected()) {
            await this.browser.close();
        }
    }

    private async createSession(): Promise<PooledSession | null> {
        if (!this.browser?.isConnected()) {
            return null;
        }

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

    async acquire(): Promise<PooledSession | null> {
        await this.recycleSessions();
        const available = this.sessions
            .filter(s => !s.isLocked && !s.context.isClosed())
            .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());

        if (available.length === 0) {
            const createdSession = await this.createSession();
            if (!createdSession) return null;
            createdSession.isLocked = true;
            createdSession.lastUsed = new Date();
            return createdSession;
        }

        const session = available[0];
        session.isLocked = true;
        session.lastUsed = new Date();
        return session;
    }

    release(session: PooledSession) {
        if (session.context.isClosed()) {
            this.sessions = this.sessions.filter(s => s !== session);
            return;
        }
        session.isLocked = false;
        session.lastUsed = new Date();
    }

    invalidate(session: PooledSession) {
        session.requestCount = this.MAX_REQUESTS + 1;
        if (!session.context.isClosed()) {
            void session.context.close().catch(() => undefined);
        }
        this.sessions = this.sessions.filter(s => s !== session);
    }

    private async recycleSessions() {
        this.sessions = this.sessions.filter(session => !session.context.isClosed());

        const now = Date.now();
        for (let index = this.sessions.length - 1; index >= 0; index--) {
            const session = this.sessions[index];
            if (session.requestCount >= this.MAX_REQUESTS || now - session.lastUsed.getTime() > this.TTL_MS) {
                if (!session.context.isClosed()) {
                    await session.context.close();
                }
                this.sessions = this.sessions.filter(s => s !== session);
            }
        }

        await this.ensurePoolSize();
    }

    private async ensurePoolSize() {
        while (this.sessions.length < this.POOL_SIZE) {
            const session = await this.createSession();
            if (!session) break;
        }
    }
}