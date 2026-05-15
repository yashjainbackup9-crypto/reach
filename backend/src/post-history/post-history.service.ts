import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PostHistory, HistoryChannelResult } from './schemas/post-history.schema';

export interface SaveHistoryDto {
  userId: Types.ObjectId;
  tenantId: string;
  scheduleId: Types.ObjectId;
  queueItemId?: string;
  originalText: string;
  rewrittenText: string;
  imageUrl?: string;
  channelResults: HistoryChannelResult[];
}

@Injectable()
export class PostHistoryService {
  constructor(
    @InjectModel(PostHistory.name) private readonly historyModel: Model<PostHistory>,
  ) {}

  async save(dto: SaveHistoryDto): Promise<PostHistory> {
    return this.historyModel.create({ ...dto, postedAt: new Date() });
  }

  async findByTenant(tenantId: string, limit = 50, offset = 0): Promise<PostHistory[]> {
    return this.historyModel
      .find({ tenantId })
      .sort({ postedAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async findBySchedule(scheduleId: string, tenantId: string): Promise<PostHistory[]> {
    return this.historyModel
      .find({ scheduleId: new Types.ObjectId(scheduleId), tenantId })
      .sort({ postedAt: -1 })
      .exec();
  }

  async findById(id: string, tenantId: string): Promise<PostHistory | null> {
    return this.historyModel.findOne({ _id: new Types.ObjectId(id), tenantId }).exec();
  }
}
