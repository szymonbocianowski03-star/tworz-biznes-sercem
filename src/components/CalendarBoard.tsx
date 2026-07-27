import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink, Download, CalendarDays, X } from "lucide-react";
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, buildIcs, downloadIcs } from "@/lib/calendarLinks";
import { readScopedJson, writeScopedJson, USER_CHANGED_EVENT } from "@/lib/userScopedStorage";

type CalEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  note?: string;
};

const STORE_KEY = "calendar.events.v1";
const WD = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function ymd(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function newId(): string {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function eventDates(ev: CalEvent): { start: Date; end: Date } {
  const start = new Date(`${ev.date}T${ev.time && /^\d{2}:\d{2}$/.test(ev.time) ? ev.time : "09:00"}:00`);
  const end = new Date(start.getTime() + 30 * 60_000);
  return { start, end };
}

export function CalendarBoard() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(() => ymd(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ title: string; time: string; note: string }>({ title: "", time: "", note: "" });

  useEffect(() => {
    const load = () => setEvents(readScopedJson<CalEvent[]>(STORE_KEY, []));
    load();
    window.addEventListener(USER_CHANGED_EVENT, load);
    return () => window.removeEventListener(USER_CHANGED_EVENT, load);
  }, []);

  const persist = (next: CalEvent[]) => {
    setEvents(next);
    writeScopedJson(STORE_KEY, next);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i += 1) arr.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDay.get(selected) ?? [];
  const todayStr = ymd(today);

  const addEvent = () => {
    const title = form.title.trim();
    if (!title) return;
    const ev: CalEvent = {
      id: newId(),
      title,
      date: selected,
      time: form.time || undefined,
      note: form.note.trim() || undefined,
    };
    persist([...events, ev]);
    setForm({ title: "", time: "", note: "" });
    setShowForm(false);
  };

  const removeEvent = (id: string) => persist(events.filter((e) => e.id !== id));

  const selectedLabel = useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }, [selected]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Calendar grid */}
      <section className="rounded-lg border border-foreground/10 bg-background shadow-soft">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">
              {MONTHS[month]} {year}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const t = new Date();
                setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
                setSelected(ymd(t));
              }}
              className="rounded-md border border-foreground/10 bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/40 transition"
            >
              Dziś
            </button>
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="h-8 w-8 rounded-md border border-foreground/10 flex items-center justify-center hover:bg-muted/40 transition"
              aria-label="Poprzedni miesiąc"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="h-8 w-8 rounded-md border border-foreground/10 flex items-center justify-center hover:bg-muted/40 transition"
              aria-label="Następny miesiąc"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-foreground/10 p-px">
          {WD.map((w) => (
            <div key={w} className="bg-background px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="bg-muted/20 min-h-[84px]" />;
            const key = ymd(cell);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = key === todayStr;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`bg-background min-h-[84px] p-1.5 text-left align-top transition hover:bg-muted/30 ${
                  isSelected ? "ring-2 ring-inset ring-foreground" : ""
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday ? "bg-foreground text-background" : "text-foreground"
                  }`}
                >
                  {cell.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div key={ev.id} className="truncate rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground">
                      {ev.time ? `${ev.time} ` : ""}{ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} więcej</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Day detail */}
      <section className="rounded-lg border border-foreground/10 bg-background shadow-soft flex flex-col">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-semibold truncate">{selectedLabel}</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Anuluj" : "Dodaj"}
          </button>
        </div>

        {showForm && (
          <div className="p-4 border-b border-foreground/10 space-y-3 bg-muted/20">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tytuł</label>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addEvent()}
                placeholder="np. Publikacja posta"
                className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Godzina (opcjonalnie)</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notatka (opcjonalnie)</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <button
              onClick={addEvent}
              disabled={!form.title.trim()}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:opacity-90 transition disabled:opacity-40"
            >
              Zapisz wydarzenie
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Brak wydarzeń w tym dniu.</p>
          ) : (
            selectedEvents.map((ev) => {
              const { start, end } = eventDates(ev);
              return (
                <div key={ev.id} className="rounded-md border border-foreground/10 bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{ev.title}</p>
                      {ev.time && <p className="text-xs text-muted-foreground mt-0.5">{ev.time}</p>}
                      {ev.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.note}</p>}
                    </div>
                    <button
                      onClick={() => removeEvent(ev.id)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
                      aria-label="Usuń wydarzenie"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <a
                      href={buildGoogleCalendarUrl({ title: ev.title, description: ev.note, start, end })}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] font-semibold hover:bg-muted/40 transition"
                    >
                      <ExternalLink className="h-3 w-3" /> Google
                    </a>
                    <a
                      href={buildOutlookCalendarUrl({ title: ev.title, description: ev.note, start, end })}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] font-semibold hover:bg-muted/40 transition"
                    >
                      <ExternalLink className="h-3 w-3" /> Outlook
                    </a>
                    <button
                      onClick={() => downloadIcs(ev.title, buildIcs({ title: ev.title, description: ev.note, start, end }))}
                      className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] font-semibold hover:bg-muted/40 transition"
                    >
                      <Download className="h-3 w-3" /> .ics
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}