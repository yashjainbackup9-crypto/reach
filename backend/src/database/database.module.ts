import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/multi-tenant-system',
      {
        dbName: process.env.DATABASE_NAME || 'multi-tenant-system',
      },
    ),
  ],
})
export class DatabaseModule {}
