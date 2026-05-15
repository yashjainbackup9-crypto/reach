export interface PostContent {
  text: string;
  mediaUrls?: string[];
  imageDataUrl?: string; // base64 data URL from AI image generation
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface IPublisher {
  readonly provider: string;
  publish(accountId: string, tenantId: string, content: PostContent): Promise<PublishResult>;
}
