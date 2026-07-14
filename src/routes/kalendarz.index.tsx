import { createFileRoute } from "@tanstack/react-router";
import { AppBackLink } from "@/components/AppBackLink";
import { CalendarBoard } from "@/components/CalendarBoard";

export const Route = createFileRoute("/kalendarz/")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8 space-y-6">
      <AppBackLink className="mb-2" />
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Kalendarz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planuj publikacje i ważne daty. Dodawaj wydarzenia i eksportuj je do Google Calendar, Outlooka lub pliku .ics.
        </p>
      </header>
      <CalendarBoard />
    </div>
  );
}