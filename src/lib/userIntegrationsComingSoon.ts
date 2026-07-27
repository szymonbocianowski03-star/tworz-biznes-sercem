/** Integracje poczty/kalendarza widoczne w UI, ale jeszcze niedostępne do połączenia. */
export type MailCalendarIntegration = "gmail" | "outlook" | "google_calendar" | "outlook_calendar";

/** Gmail + Google Calendar są dostępne; Outlook pozostaje „wkrótce”. */
export const MAIL_CALENDAR_COMING_SOON = new Set<MailCalendarIntegration>([
  "outlook",
  "outlook_calendar",
]);

export function isMailCalendarComingSoon(integration: MailCalendarIntegration): boolean {
  return MAIL_CALENDAR_COMING_SOON.has(integration);
}
