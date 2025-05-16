import { DynamicModule, Global, Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import {
  GOOGLE_CALENDAR_CONFIG,
  GoogleCalendarConfig,
} from './google-calendar.config';

@Global()
@Module({})
export class GoogleCalendarModule {
  static forRoot(config: GoogleCalendarConfig): DynamicModule {
    return {
      imports: [],
      module: GoogleCalendarModule,
      providers: [
        {
          provide: GOOGLE_CALENDAR_CONFIG,
          useValue: config,
        },
        GoogleCalendarService,
      ],
      exports: [GOOGLE_CALENDAR_CONFIG, GoogleCalendarService],
    };
  }
}
