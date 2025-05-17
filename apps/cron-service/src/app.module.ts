// apps/cron-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CronModule } from './cron/cron.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'notification_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    CronModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
