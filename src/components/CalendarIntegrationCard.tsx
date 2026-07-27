import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, Download } from "lucide-react";
import { buildGoogleCalendarUrl, buildIcs, buildOutlookCalendarUrl, downloadIcs } from "@/lib/calendarLinks";

const KEY = "mn.calendar.enabled.v1";

export function CalendarIntegrationCard() {
  const [enabled, setEnabled] = useState(true);
  const [when, setWhen] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    d.setSeconds(0);
    d.setMilliseconds(0);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw != null) setEnabled(raw === "true");
    } catch {}
  }, []);

  const toggle = (v: boolean) => {
    setEnabled(v);
    try {
      localStorage.setItem(KEY, String(v));
    } catch {}
  };

  const event = useMemo(() => {
    const start = when ? new Date(when) : new Date();
    const end = new Date(start.getTime() + 30 * 60_000);
    return {
      title: "Zaplanowana publikacja posta",
      description: "Wydarzenie utworzone w MarketingNow (schedule post).",
      start,
      end,
    };
  }, [when]);

  return (
    <section className="rounded-md border border-foreground/10 bg-background shadow-soft">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight">Kalendarze (Google / Outlook / ICS)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dodawaj zaplanowane publikacje do kalendarza. Bez integracji OAuth — działa przez linki i plik <span className="font-mono">.ics</span>.
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              enabled ? "bg-emerald-50 text-emerald-700 border-emerald-600/20" : "bg-muted text-muted-foreground border-foreground/10"
            }`}
          >
            {enabled ? "Włączone" : "Wyłączone"}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-foreground/10 bg-muted/20 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Dodawaj do kalendarza przy „Schedule post”</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Włącza przyciski „Dodaj do kalendarza” w miejscu planowania publikacji.
            </p>
          </div>
          <button
            onClick={() => toggle(!enabled)}
            className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
              enabled ? "bg-foreground" : "bg-muted-foreground/30"
            }`}
            aria-pressed={enabled}
            aria-label="Kalendarze"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr] items-end">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Przykładowa data</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={buildGoogleCalendarUrl(event)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm font-semibold hover:bg-muted/40 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Google Calendar
            </a>
            <a
              href={buildOutlookCalendarUrl(event)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm font-semibold hover:bg-muted/40 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Outlook
            </a>
            <button
              onClick={() => downloadIcs("schedule-post", buildIcs(event))}
              className="inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm font-semibold hover:bg-muted/40 transition"
            >
              <Download className="h-4 w-4" />
              Pobierz .ics
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

