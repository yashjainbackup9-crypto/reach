import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostHistory, PostHistorySchema } from './schemas/post-history.schema';
import { PostHistoryService } from './post-history.service';
import { PostHistoryController } from './post-history.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PostHistory.name, schema: PostHistorySchema }])],
  controllers: [PostHistoryController],
  providers: [PostHistoryService],
  exports: [PostHistoryService],
})
export class PostHistoryModule {}
