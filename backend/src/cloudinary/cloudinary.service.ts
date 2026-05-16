import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  private ensureConfigured() {
    if (this.configured) return;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    this.configured = true;
  }

  async uploadBase64Image(base64DataUrl: string, folder = 'post-history'): Promise<string> {
    this.ensureConfigured();
    this.logger.debug(`Uploading image to Cloudinary folder=${folder}`);
    const result = await cloudinary.uploader.upload(base64DataUrl, {
      folder,
      resource_type: 'image',
    });
    return result.secure_url;
  }

  async uploadVideo(filePath: string, folder = 'generated-videos'): Promise<string> {
    this.ensureConfigured();
    this.logger.debug(`Uploading video to Cloudinary folder=${folder} path=${filePath}`);
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'video',
      chunk_size: 6_000_000,
    });
    return result.secure_url;
  }
}
