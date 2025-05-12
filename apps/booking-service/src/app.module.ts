import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app/app.config';
import authConfig from './config/auth/auth.config';
import templateConfig from './config/template/template.config';
import { DatabaseModule } from './database/database.module';
import { SendGridModule } from '@packages/integration';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, templateConfig],
      envFilePath:
        process.env.NODE_ENV === 'development'
          ? '.env.development'
          : '.env.production',
    }),
    SendGridModule.forRoot({
      apiKey: process.env.SENDGRID_API_KEY,
      defaultSender: process.env.SENDGRID_FROM_EMAIL,
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    DatabaseModule,
    // AuthModule,
    UploadModule,
    // ReviewModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
