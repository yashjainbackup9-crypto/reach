const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  tenantId: string;
  profile?: { firstName?: string; lastName?: string };
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => request<{ message: string; user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  profile: () => request<User>('/api/auth/profile'),
};

// ─── Content / Tones ──────────────────────────────────────────────────────

export interface Tone {
  _id: string;
  name: string;
  tone: string;
  description?: string;
  source?: string;
  createdAt?: string;
}

export interface GenerateToneResponse {
  tonePrompt: string;
  label: string;
  source: string;
  caption?: string;
  saved: Tone;
}

export interface ContentRewrite {
  rewrittenContent: string;
  toneName: string;
  tonePrompt: string;
}

export interface ImageGenerationResponse {
  imageDataUrl: string;
  revisedPrompt?: string;
  model: string;
  prompt: string;
}

export interface ImageGenerationRequest {
  prompt?: string;
  instagramUrl?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'auto' | 'high' | 'medium' | 'low';
  style?: 'vivid' | 'natural';
  apiKey?: string;
}

export const contentApi = {
  generateTone: (data: { type: 'instagram_link' | 'text'; input: string; name: string }) =>
    request<GenerateToneResponse>('/api/content/generate-tone', { method: 'POST', body: JSON.stringify(data) }),

  rewrite: (data: { content: string; toneName: string }) =>
    request<ContentRewrite>('/api/content/rewrite', { method: 'POST', body: JSON.stringify(data) }),

  generateImage: (data: ImageGenerationRequest) =>
    request<ImageGenerationResponse>('/api/content/generate-image', { method: 'POST', body: JSON.stringify(data) }),

  getTones: () => request<Tone[]>('/api/content/tones'),

  getTone: (id: string) => request<Tone>(`/api/content/tones/${id}`),

  createTone: (data: { name: string; tone: string; description?: string }) =>
    request<Tone>('/api/content/tones', { method: 'POST', body: JSON.stringify(data) }),

  updateTone: (id: string, data: { name?: string; tone?: string; description?: string }) =>
    request<Tone>(`/api/content/tones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteTone: (id: string) =>
    request<{ message: string }>(`/api/content/tones/${id}`, { method: 'DELETE' }),
};

// ─── Accounts ─────────────────────────────────────────────────────────────

export interface Account {
  _id: string;
  platform: string;
  profileName: string;
  profileUrl?: string;
  username?: string;
  supportedPostTypes?: string[];
}

export const accountsApi = {
  getAll: () => request<Account[]>('/api/accounts'),

  linkedin: {
    getAuthUrl: () => request<{ authUrl: string; state: string }>('/api/accounts/linkedin/auth-url'),
    callback: (data: { code: string; state: string }) =>
      request<{ message: string; account: any }>('/api/accounts/linkedin/callback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAccounts: () => request<Account[]>('/api/accounts/linkedin/accounts'),
    disconnect: (accountId: string) =>
      request<{ message: string }>(`/api/accounts/linkedin/accounts/${accountId}`, { method: 'DELETE' }),
  },

  instagram: {
    getAuthUrl: () => request<{ authUrl: string; state: string }>('/api/accounts/instagram/auth-url'),
    callback: (data: { code: string; state: string }) =>
      request<{ message: string; accounts: any[] }>('/api/accounts/instagram/callback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAccounts: () => request<Account[]>('/api/accounts/instagram/accounts'),
    disconnect: (accountId: string) =>
      request<{ message: string }>(`/api/accounts/instagram/accounts/${accountId}`, { method: 'DELETE' }),
  },
  facebook: {
    getAuthUrl: () => request<{ authUrl: string; state: string }>('/api/accounts/facebook/auth-url'),
    callback: (data: { code: string; state: string }) =>
      request<{ message: string; accounts: any[] }>('/api/accounts/facebook/callback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAccounts: () => request<Account[]>('/api/accounts/facebook/accounts'),
    disconnect: (accountId: string) =>
      request<{ message: string }>(`/api/accounts/facebook/accounts/${accountId}`, { method: 'DELETE' }),
  },
};

// ─── Telegram ─────────────────────────────────────────────────────────────

export interface TelegramBot {
  _id: string;
  botUsername: string;
  botName: string;
  botToken: string;
  isActive?: boolean;
  createdAt?: string;
}

export const telegramApi = {
  registerBot: (data: { botToken: string }) =>
    request<TelegramBot>('/api/telegram/bots', { method: 'POST', body: JSON.stringify(data) }),

  getBots: () => request<TelegramBot[]>('/api/telegram/bots'),

  deleteBot: (id: string) =>
    request<{ message: string }>(`/api/telegram/bots/${id}`, { method: 'DELETE' }),
};

// ─── Queues ───────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string;
  type?: string;
  source?: string;
  status: 'pending' | 'processing' | 'ready' | 'posted' | 'failed';
  text?: string;
  url?: string;
  caption?: string;
  mediaUrls?: string[];
  metadata?: { author?: string; pageTitle?: string };
  addedAt: string;
  processedAt?: string;
  error?: string;
}

// ─── Schedules ────────────────────────────────────────────────────────────

export interface AiConfig {
  provider?: string;
  model?: string;
  // apiKey is write-only — never returned from the API
  maxTokens?: number;
}

export interface ImageConfig {
  enabled: boolean;
  customPrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  // apiKey is write-only — never returned from the API
}

export interface TelegramFlowSchedule {
  _id: string;
  name: string;
  type: 'telegram-flow';
  telegramBotId: string | { _id: string; botUsername: string; botName: string };
  toneId?: string | { _id: string; name: string } | null;
  times: string[];
  aiConfig?: AiConfig;
  isActive: boolean;
  lastRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TelegramFlowCreateDto {
  name: string;
  telegramBotId: string;
  toneId?: string;
  times: string[];
  aiConfig?: AiConfig & { apiKey?: string };
}

export interface TelegramFlowUpdateDto {
  name?: string;
  telegramBotId?: string;
  toneId?: string;
  times?: string[];
  isActive?: boolean;
  aiConfig?: AiConfig & { apiKey?: string };
}

export interface ContentFlowSchedule {
  _id: string;
  name: string;
  type: 'content-flow';
  channels: { provider: string; accountId: string }[];
  toneId?: string | { _id: string; name: string } | null;
  times: string[];
  aiConfig?: AiConfig;
  imageConfig?: ImageConfig;
  isActive: boolean;
  lastRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentFlowCreateDto {
  name: string;
  channels: { provider: string; accountId: string }[];
  toneId?: string;
  times: string[];
  aiConfig?: AiConfig & { apiKey?: string };
  imageConfig?: ImageConfig & { apiKey?: string };
}

export interface ContentFlowUpdateDto {
  name?: string;
  channels?: { provider: string; accountId: string }[];
  toneId?: string;
  times?: string[];
  isActive?: boolean;
  aiConfig?: AiConfig & { apiKey?: string };
  imageConfig?: ImageConfig & { apiKey?: string };
}

type RunResult = { posted: boolean; itemId?: string; channelResults: { provider: string; accountId: string; success: boolean; error?: string }[] };

export const schedulesApi = {
  telegramFlow: {
    getAll: () => request<TelegramFlowSchedule[]>('/api/schedules/telegram-flow'),
    getOne: (id: string) => request<TelegramFlowSchedule>(`/api/schedules/telegram-flow/${id}`),
    create: (data: TelegramFlowCreateDto) =>
      request<TelegramFlowSchedule>('/api/schedules/telegram-flow', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: TelegramFlowUpdateDto) =>
      request<TelegramFlowSchedule>(`/api/schedules/telegram-flow/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/schedules/telegram-flow/${id}`, { method: 'DELETE' }),
    run: (id: string) =>
      request<RunResult>(`/api/schedules/telegram-flow/${id}/run`, { method: 'POST' }),
  },
  contentFlow: {
    getAll: () => request<ContentFlowSchedule[]>('/api/schedules/content-flow'),
    getOne: (id: string) => request<ContentFlowSchedule>(`/api/schedules/content-flow/${id}`),
    create: (data: ContentFlowCreateDto) =>
      request<ContentFlowSchedule>('/api/schedules/content-flow', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: ContentFlowUpdateDto) =>
      request<ContentFlowSchedule>(`/api/schedules/content-flow/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/schedules/content-flow/${id}`, { method: 'DELETE' }),
    run: (id: string) =>
      request<RunResult>(`/api/schedules/content-flow/${id}/run`, { method: 'POST' }),
  },
};

// ─── Post History ─────────────────────────────────────────────────────────

export interface HistoryChannelResult {
  provider: string;
  accountId: string;
  success: boolean;
  error?: string;
}

export interface PostHistoryEntry {
  _id: string;
  scheduleId: string;
  queueItemId?: string;
  originalText: string;
  rewrittenText: string;
  imageUrl?: string;
  channelResults: HistoryChannelResult[];
  postedAt: string;
  createdAt?: string;
}

export interface RepostResult {
  channelResults: { provider: string; accountId: string; success: boolean; error?: string }[];
}

export const postHistoryApi = {
  getAll: (limit = 50, offset = 0) =>
    request<PostHistoryEntry[]>(`/api/post-history?limit=${limit}&offset=${offset}`),

  getBySchedule: (scheduleId: string) =>
    request<PostHistoryEntry[]>(`/api/post-history/schedule/${scheduleId}`),

  getOne: (id: string) =>
    request<PostHistoryEntry>(`/api/post-history/${id}`),

  repost: (id: string, channels: { provider: string; accountId: string }[]) =>
    request<RepostResult>(`/api/post-history/${id}/repost`, {
      method: 'POST',
      body: JSON.stringify({ channels }),
    }),
};

// ─── Queues ───────────────────────────────────────────────────────────────

export const queuesApi = {
  getQueue: () => request<{ items: QueueItem[] }>('/api/queues'),

  addItem: (data: {
    type?: string;
    source?: string;
    text?: string;
    url?: string;
  }) => request<{ message: string; itemId: string }>('/api/queues', { method: 'POST', body: JSON.stringify(data) }),

  removeItem: (index: number) =>
    request<{ message: string }>(`/api/queues/${index}`, { method: 'DELETE' }),

  reprocessItem: (index: number) =>
    request<{ message: string }>(`/api/queues/${index}/reprocess`, { method: 'POST' }),
};
