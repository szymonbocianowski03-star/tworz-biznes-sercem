export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toUtcCompact(d: Date) {
  return [
    d.getUTCFullYear(),
    pad2(d.getUTCMonth() + 1),
    pad2(d.getUTCDate()),
    "T",
    pad2(d.getUTCHours()),
    pad2(d.getUTCMinutes()),
    pad2(d.getUTCSeconds()),
    "Z",
  ].join("");
}

export function buildGoogleCalendarUrl(e: CalendarEventInput) {
  const base = "https://calendar.google.com/calendar/render";
  const dates = `${toUtcCompact(e.start)}/${toUtcCompact(e.end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
  });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `${base}?${params.toString()}`;
}

export function buildOutlookCalendarUrl(e: CalendarEventInput) {
  const base = "https://outlook.live.com/calendar/0/deeplink/compose";
  const params = new URLSearchParams({
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: e.end.toISOString(),
  });
  if (e.description) params.set("body", e.description);
  if (e.location) params.set("location", e.location);
  return `${base}?${params.toString()}`;
}

export function buildIcs(e: CalendarEventInput) {
  const uid = `mn-${Math.random().toString(36).slice(2)}@marketingnow`;
  const dtstamp = toUtcCompact(new Date());
  const dtstart = toUtcCompact(e.start);
  const dtend = toUtcCompact(e.end);

  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MarketingNow//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${esc(e.title)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : null,
    e.location ? `LOCATION:${esc(e.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

