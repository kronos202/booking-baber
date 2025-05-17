import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import {
  GOOGLE_CALENDAR_CONFIG,
  GoogleCalendarConfig,
} from './google-calendar.config';

@Injectable()
export class GoogleCalendarService {
  private oauth2Client: any;
  private webhookUri: string;

  constructor(
    @Inject(GOOGLE_CALENDAR_CONFIG) private config: GoogleCalendarConfig,
  ) {
    this.oauth2Client = new google.auth.OAuth2({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    this.webhookUri = config.webhookUri ?? '';
  }

  getToken(code: string) {
    return this.oauth2Client.getToken(code);
  }

  getGoogleAuthUrl(): { authUrl: string } {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events.owned'],
    });

    return {
      authUrl,
    };
  }

  createWebhookChannel(
    refreshToken: string,
    {
      id,
      token,
    }: {
      id: string;
      token: string;
    },
  ) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });
    console.log('this.webhookUri ', this.webhookUri);

    return calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id,
        token,
        type: 'webhook',
        address: this.webhookUri,
      },
    });
  }

  // watchNewEvent(token: string,) {
  //   const calendar = google.calendar({
  //     version: 'v3',
  //     auth: this.oauth2Client,
  //   });

  //   return calendar.events.watch({
  //     calendarId: 'primary',
  //     requestBody: {
  //       id,
  //       token,
  //       type: 'webhook',
  //       address: this.webhookUri,
  //     },
  //   });
  // }

  getListEvents(refreshToken: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

    return calendar.events.list({
      calendarId: 'primary',
      maxResults: 2500,
      // singleEvents: true,
    });
  }

  getSyncedEvents(refreshToken: string, syncToken: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

    return calendar.events.list({
      calendarId: 'primary',
      maxResults: 2500,
      syncToken,
    });
  }

  async getSyncToken(refreshToken: string) {
    // do while
    const { data } = await this.getListEvents(refreshToken);
    const syncToken = data.nextSyncToken;
    if (!syncToken) {
      throw new BadRequestException('Sync token not exist');
    }

    return syncToken;
  }

  async createEvent(refreshToken: string, data: calendar_v3.Schema$Event) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: data,
    });

    return response.data;
  }
}
