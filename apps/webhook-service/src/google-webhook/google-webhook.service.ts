// apps/webhook-service/src/google-webhook/google-webhook.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../../../booking-service/src/database/database.service';
import dayjs from 'dayjs';
import { GoogleCalendarService } from '@packages/integration';
@Injectable()
export class GoogleWebhookService {
  private readonly logger = new Logger(GoogleWebhookService.name);

  constructor(
    @Inject('WEBHOOK_SERVICE') private readonly client: ClientProxy,
    private databaseService: DatabaseService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async handleGoogleCalendarWebhook(
    credentialId: number,
    webhookToken: string,
  ) {
    this.logger.log(
      `Nhận webhook Google Calendar, credentialId=${credentialId}`,
    );

    // Đẩy webhook vào RabbitMQ queue
    try {
      await firstValueFrom(
        this.client.emit('google_calendar_webhook', {
          credentialId,
          webhookToken,
        }),
      );
      this.logger.log(
        `Đẩy webhook Google Calendar vào queue google_calendar_webhook thành công`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi đẩy webhook Google Calendar vào queue: ${error.message}`,
      );
      throw new InternalServerErrorException('Lỗi khi đẩy webhook vào queue');
    }

    return { message: 'Webhook Google Calendar nhận thành công' };
  }

  async handle(credentialId: number) {
    const foundCredential = await this.databaseService.credential.findFirst({
      where: { id: credentialId },
    });
    if (!foundCredential) {
      return;
    }
    const syncToken = foundCredential.sync_token;
    if (!syncToken) {
      this.logger.log(
        `Không có sync_token cho credentialId=${credentialId}, không thể đồng bộ hóa`,
      );
      return;
    }
    const syncedEventsResponse =
      await this.googleCalendarService.getSyncedEvents(
        foundCredential.token,
        syncToken,
      );
    const syncedEvents = syncedEventsResponse.data.items;
    const syncedEventIds = syncedEvents?.map((e) => e.id) as string[];
    const externalSessions =
      await this.databaseService.externalSession.findMany({
        where: {
          externalSessionId: { in: syncedEventIds },
        },
      });
    for (const externalSession of externalSessions) {
      const syncedEvent = syncedEvents?.find(
        (se) => se.id === externalSession.externalSessionId,
      );
      await this.databaseService.booking.update({
        where: {
          id: externalSession.bookingId,
        },
        data: {
          startAt: dayjs(syncedEvent?.start?.dateTime).format(),
        },
      });
    }
  }
}
