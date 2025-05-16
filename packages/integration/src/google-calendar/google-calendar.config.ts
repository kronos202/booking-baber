export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  webhookUri?: string;
}
export const GOOGLE_CALENDAR_CONFIG = 'GOOGLE_CALENDAR_CONFIG';
