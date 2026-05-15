import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LinkedInAccountController } from './linkedin-account.controller';
import { InstagramAccountController } from './instagram-account.controller';
import { AccountsController } from './accounts.controller';
import { LinkedInProvider } from '../providers/linkedin.provider';
import { InstagramProvider } from '../providers/instagram.provider';
import { LinkedInAccountSchema } from './schemas/linkedin-account.schema';
import { InstagramAccountSchema } from './schemas/instagram-account.schema';
import { FacebookAccountSchema } from './schemas/facebook-account.schema';
import { FacebookAccountController } from './facebook-account.controller';
import { FacebookProvider } from '../providers/facebook.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'LinkedInAccount', schema: LinkedInAccountSchema },
      { name: 'InstagramAccount', schema: InstagramAccountSchema },
      { name: 'FacebookAccount', schema: FacebookAccountSchema },
    ]),
  ],
  controllers: [LinkedInAccountController, InstagramAccountController, FacebookAccountController, AccountsController],
  providers: [LinkedInProvider, InstagramProvider, FacebookProvider],
  exports: [LinkedInProvider, InstagramProvider, FacebookProvider],
})
export class AccountsModule {}

