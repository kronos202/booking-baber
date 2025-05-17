// apps/cron-service/src/cron/cron.module.ts
import { Module } from '@nestjs/common';
import { CronService } from './cron.service';

@Module({
  imports: [],
  providers: [CronService],
})
export class CronModule {}
