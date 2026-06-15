import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, CalendarDays, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getUserEmailStatus,
  disconnectUserEmail,
  saveSmtpConnection,
  sendUserEmail,
} from "@/lib/userEmail.functions";
import {
  getUserCalendarStatus,
  disconnectUserCalendar,
  scheduleUserCalendarEvent,
} from "@/lib/userCalendar.functions";

export function UserIntegrationsCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<Awaited<ReturnType<typeof getUserEmailStatus>> | null>(null);
  const [cal, setCal] = useState<Awaited<ReturnType<typeof getUserCalendarStatus>> | null>(null);
  const [resendKey, setResendKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const fnEmailStatus = useServerFn(getUserEmailStatus);
  const fnCalStatus = useServerFn(getUserCalendarStatus);
  const fnDiscEmail = useServerFn(disconnectUserEmail);
  const fnDiscCal = useServerFn(disconnectUserCalendar);
  const fnSaveSmtp = useServerFn(saveSmtpConnection);
  const fnSend = useServerFn(sendUserEmail);
  const fnSchedule = useServerFn(scheduleUserCalendarEvent);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id ?? null);
    if (!auth.user) {
      setLoading(false);
      return;
    }
    try {
      const [e, c] = await Promise.all([fnEmailStatus(), fnCalStatus()]);
      setEmail(e);
      setCal(c);
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  }, [fnEmailStatus, fnCalStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const connectGoogle = async (service: "gmail" | "calendar") => {
    if (!userId) return toast.error("Zaloguj się.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return toast.error("Zaloguj się ponownie.");
    window.location.href = `/api/public/google/start?token=${encodeURIComponent(token)}&service=${service}&force_login=1`;
  };
  const connectMicrosoft = async (service: "mail" | "calendar") => {
    if (!userId) return toast.error("Zaloguj się.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return toast.error("Zaloguj się ponownie.");
    window.location.href = `/api/public/microsoft/start?token=${encodeURIComponent(token)}&service=${service}`;
  };

  const saveResend = async () => {
    if (!fromEmail || !resendKey) {
      toast.error("Podaj adres From i klucz API Resend.");
      return;
    }
    try {
      await fnSaveSmtp({
        data: { provider: "resend", from_email: fromEmail, resend_api_key: resendKey },
      });
      toast.success("Zapisano klucz Resend.");
      setResendKey("");
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Błąd zapisu");
    }
  };

  const sendTest = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const to = auth.user?.email;
    if (!to) return toast.error("Brak emaila konta.");
    try {
      const r = await fnSend({
        data: {
          to,
          subject: "MarketingNow — test wysyłki",
          html: "<p>To jest test integracji e-mail z MarketingNow ✅</p>",
        },
      });
      toast.success(`Wysłano przez ${r.provider}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Błąd wysyłki");
    }
  };

  const scheduleTest = async (providers: ("google" | "outlook")[]) => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60_000).toISOString();
    const end = new Date(now.getTime() + 90 * 60_000).toISOString();
    try {
      const r = await fnSchedule({
        data: {
          title: "MarketingNow — test event",
          description: "Testowe wydarzenie z integracji.",
          start,
          end,
          providers,
        },
      });
      r.results.forEach((res) => {
        if (res.ok) toast.success(`${res.provider} ok — ${res.link ?? ""}`);
        else toast.error(`${res.provider}: ${res.error}`);
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Błąd");
    }
  };

  const disconnectEmail = async (provider: "gmail" | "outlook" | "smtp") => {
    await fnDiscEmail({ data: { provider } });
    toast.success("Rozłączono.");
    void load();
  };
  const disconnectCal = async (provider: "google" | "outlook") => {
    await fnDiscCal({ data: { provider } });
    toast.success("Rozłączono.");
    void load();
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-foreground/10 bg-card p-5 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (!userId) {
    return (
      <section className="rounded-xl border border-foreground/10 bg-card p-5">
        <p className="text-sm text-muted-foreground">Zaloguj się, aby zarządzać integracjami e-mail i kalendarza.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* EMAIL */}
      <section className="rounded-xl border border-foreground/10 bg-card p-5">
        <header className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Wysyłka e-mail</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wybierz, z jakiego konta aplikacja będzie wysyłać maile w Twoim imieniu.
            </p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <ProviderTile
            title="Gmail"
            status={email?.gmail?.email}
            onConnect={() => connectGoogle("gmail")}
            onDisconnect={() => disconnectEmail("gmail")}
          />
          <ProviderTile
            title="Outlook"
            status={email?.outlook?.email}
            onConnect={() => connectMicrosoft("mail")}
            onDisconnect={() => disconnectEmail("outlook")}
          />
          <ProviderTile
            title="Resend / SMTP"
            status={email?.smtp ? `${email.smtp.provider}: ${email.smtp.from_email}` : null}
            onConnect={null}
            onDisconnect={email?.smtp ? () => disconnectEmail("smtp") : null}
          />
        </div>

        {!email?.smtp && (
          <div className="mt-4 rounded-lg border border-foreground/10 bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Klucz Resend (alternatywa)</p>
            <input
              type="email"
              placeholder="From: hello@twojadomena.pl"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="re_xxx — klucz API z resend.com"
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => void saveResend()}
              className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold"
            >
              Zapisz klucz Resend
            </button>
          </div>
        )}

        {(email?.gmail || email?.outlook || email?.smtp) && (
          <button
            onClick={() => void sendTest()}
            className="mt-4 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Wyślij test do siebie
          </button>
        )}
      </section>

      {/* CALENDAR */}
      <section className="rounded-xl border border-foreground/10 bg-card p-5">
        <header className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Kalendarze (OAuth)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Połącz kalendarz, żeby planowane posty trafiały automatycznie do Twojego kalendarza.
              Jeśli Google pokazuje błąd redirect_uri, w Google Cloud dodaj adres:{" "}
              <code className="text-[11px] bg-muted px-1 rounded break-all">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/public/auth/google/callback`
                  : "/api/public/auth/google/callback"}
              </code>
            </p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <ProviderTile
            title="Google Calendar"
            status={cal?.google?.email}
            onConnect={() => connectGoogle("calendar")}
            onDisconnect={() => disconnectCal("google")}
          />
          <ProviderTile
            title="Outlook Calendar"
            status={cal?.outlook?.email}
            onConnect={() => connectMicrosoft("calendar")}
            onDisconnect={() => disconnectCal("outlook")}
          />
        </div>

        {(cal?.google || cal?.outlook) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cal?.google && (
              <button
                onClick={() => void scheduleTest(["google"])}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Utwórz testowy event w Google
              </button>
            )}
            {cal?.outlook && (
              <button
                onClick={() => void scheduleTest(["outlook"])}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Utwórz testowy event w Outlook
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ProviderTile({
  title,
  status,
  onConnect,
  onDisconnect,
}: {
  title: string;
  status: string | null | undefined;
  onConnect: (() => void) | null;
  onDisconnect: (() => void) | null;
}) {
  const connected = Boolean(status);
  return (
    <div className="rounded-lg border border-foreground/10 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">{title}</span>
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-600/20 px-2 py-0.5 text-[11px] font-semibold">
            <Check className="h-3 w-3" /> połączone
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
            <X className="h-3 w-3" /> nie
          </span>
        )}
      </div>
      {connected && <p className="mt-1 text-xs text-muted-foreground truncate">{status}</p>}
      <div className="mt-2 flex gap-1.5">
        {onConnect && (
          <button
            onClick={onConnect}
            className="rounded-md bg-foreground text-background px-2.5 py-1 text-[11px] font-semibold"
          >
            {connected ? "Zmień konto" : "Połącz"}
          </button>
        )}
        {connected && onDisconnect && (
          <button
            onClick={onDisconnect}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
          >
            Rozłącz
          </button>
        )}
      </div>
    </div>
  );
}