import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, CalendarDays, Check, X, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getUserEmailStatus,
  disconnectUserEmail,
  saveSmtpConnection,
  sendUserEmail,
} from "@/lib/userEmail.functions";
import {
  getUserKlaviyoStatus,
  saveKlaviyoConnection,
  disconnectUserKlaviyo,
  subscribeToKlaviyo,
  trackKlaviyoEvent,
} from "@/lib/userKlaviyo.functions";
import {
  getUserCalendarStatus,
  disconnectUserCalendar,
  scheduleUserCalendarEvent,
} from "@/lib/userCalendar.functions";
import { isMailCalendarComingSoon } from "@/lib/userIntegrationsComingSoon";

export function UserIntegrationsCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<Awaited<ReturnType<typeof getUserEmailStatus>> | null>(null);
  const [cal, setCal] = useState<Awaited<ReturnType<typeof getUserCalendarStatus>> | null>(null);
  const [resendKey, setResendKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [klaviyo, setKlaviyo] = useState<Awaited<ReturnType<typeof getUserKlaviyoStatus>> | null>(null);
  const [klaviyoKey, setKlaviyoKey] = useState("");
  const [klaviyoFrom, setKlaviyoFrom] = useState("");
  const [klaviyoList, setKlaviyoList] = useState("");
  const [klaviyoBusy, setKlaviyoBusy] = useState(false);

  const fnEmailStatus = useServerFn(getUserEmailStatus);
  const fnCalStatus = useServerFn(getUserCalendarStatus);
  const fnDiscEmail = useServerFn(disconnectUserEmail);
  const fnDiscCal = useServerFn(disconnectUserCalendar);
  const fnSaveSmtp = useServerFn(saveSmtpConnection);
  const fnSend = useServerFn(sendUserEmail);
  const fnSchedule = useServerFn(scheduleUserCalendarEvent);
  const fnKlaviyoStatus = useServerFn(getUserKlaviyoStatus);
  const fnKlaviyoSave = useServerFn(saveKlaviyoConnection);
  const fnKlaviyoDisc = useServerFn(disconnectUserKlaviyo);
  const fnKlaviyoSubscribe = useServerFn(subscribeToKlaviyo);
  const fnKlaviyoEvent = useServerFn(trackKlaviyoEvent);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id ?? null);
    if (!auth.user) {
      setLoading(false);
      return;
    }
    try {
      const [e, c, k] = await Promise.all([fnEmailStatus(), fnCalStatus(), fnKlaviyoStatus()]);
      setEmail(e);
      setCal(c);
      setKlaviyo(k);
      setKlaviyoFrom(k?.from_email ?? "");
      setKlaviyoList(k?.default_list_id ?? "");
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  }, [fnEmailStatus, fnCalStatus, fnKlaviyoStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const connectGoogle = async (service: "gmail" | "calendar") => {
    if (!userId) return toast.error("Zaloguj się.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return toast.error("Zaloguj się ponownie.");
    const startUrl = new URL("/api/public/google/start", googleIntegrationOrigin());
    startUrl.searchParams.set("token", token);
    startUrl.searchParams.set("service", service);
    startUrl.searchParams.set("force_login", "1");
    startUrl.searchParams.set("return_to", `${window.location.origin}/integrations`);
    window.location.href = startUrl.toString();
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
    const key = resendKey.trim();
    if (!key.startsWith("re_") || key.length < 16) {
      toast.error(
        "To nie wygląda na poprawny klucz Resend. Skopiuj cały klucz z resend.com/api-keys — zaczyna się od „re_” i ma ok. 30 znaków.",
      );
      return;
    }
    try {
      await fnSaveSmtp({
        data: { provider: "resend", from_email: fromEmail.trim(), resend_api_key: key },
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

  const saveKlaviyo = async () => {
    if (!klaviyoKey.trim()) {
      toast.error("Wklej Private API Key Klaviyo (zaczyna się od „pk_”).");
      return;
    }
    setKlaviyoBusy(true);
    try {
      await fnKlaviyoSave({
        data: {
          private_api_key: klaviyoKey.trim(),
          from_email: klaviyoFrom.trim(),
          default_list_id: klaviyoList.trim(),
        },
      });
      toast.success("Połączono z Klaviyo.");
      setKlaviyoKey("");
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Błąd zapisu Klaviyo");
    } finally {
      setKlaviyoBusy(false);
    }
  };

  const disconnectKlaviyo = async () => {
    await fnKlaviyoDisc();
    toast.success("Rozłączono Klaviyo.");
    setKlaviyo(null);
    void load();
  };

  const testKlaviyoSubscribe = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const to = auth.user?.email;
    if (!to) return toast.error("Brak emaila konta.");
    setKlaviyoBusy(true);
    try {
      const r = await fnKlaviyoSubscribe({ data: { email: to } });
      toast.success(r.subscribed ? "Dodano kontakt i zapisano na listę." : "Dodano kontakt do Klaviyo.");
    } catch (e: any) {
      toast.error(e?.message ?? "Błąd Klaviyo");
    } finally {
      setKlaviyoBusy(false);
    }
  };

  const testKlaviyoEvent = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const to = auth.user?.email;
    if (!to) return toast.error("Brak emaila konta.");
    setKlaviyoBusy(true);
    try {
      await fnKlaviyoEvent({
        data: { email: to, metric: "MarketingNow Test Event", properties: { source: "integrations" } },
      });
      toast.success("Wysłano testowy event do Klaviyo (uruchomi pasujący flow).");
    } catch (e: any) {
      toast.error(e?.message ?? "Błąd Klaviyo");
    } finally {
      setKlaviyoBusy(false);
    }
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
            comingSoon={isMailCalendarComingSoon("gmail")}
            onConnect={() => connectGoogle("gmail")}
            onDisconnect={() => disconnectEmail("gmail")}
          />
          <ProviderTile
            title="Outlook"
            status={email?.outlook?.email}
            comingSoon={isMailCalendarComingSoon("outlook")}
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

        <div className="mt-4 rounded-lg border border-foreground/10 bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {email?.smtp ? "Zaktualizuj klucz Resend" : "Klucz Resend (alternatywa)"}
          </p>
          {email?.smtp && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aktualnie połączone:{" "}
              <span className="font-semibold text-foreground">
                {email.smtp.provider} · {email.smtp.from_email}
              </span>
              . Możesz wkleić nowy klucz, aby go nadpisać.
            </p>
          )}
          <input
            type="email"
            placeholder="From: hello@twojadomena.pl"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            autoComplete="off"
            placeholder="re_xxx — klucz API z resend.com"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Klucz utworzysz na{" "}
            <span className="font-semibold text-foreground">resend.com → API Keys</span>. Adres „From” musi
            należeć do domeny zweryfikowanej w Resend (inaczej Resend odrzuci wysyłkę).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void saveResend()}
              className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold"
            >
              {email?.smtp ? "Zapisz nowy klucz" : "Zapisz klucz Resend"}
            </button>
            {email?.smtp && (
              <>
                <button
                  onClick={() => void sendTest()}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Wyślij test do siebie
                </button>
                <button
                  onClick={() => void disconnectEmail("smtp")}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Rozłącz Resend
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* KLAVIYO */}
      <section className="rounded-xl border border-foreground/10 bg-card p-5">
        <header className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Send className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight">Klaviyo</h2>
              {klaviyo ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-600/20 px-2 py-0.5 text-[11px] font-semibold">
                  <Check className="h-3 w-3" /> połączone
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
                  <X className="h-3 w-3" /> nie
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Podłącz własne konto Klaviyo, aby synchronizować kontakty, zapisywać na newsletter i wyzwalać automatyczne przepływy (flows).
            </p>
          </div>
        </header>

        <div className="rounded-lg border border-foreground/10 bg-muted/20 p-4 space-y-3">
          {klaviyo && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aktualnie połączone
              {klaviyo.from_email ? (
                <>
                  {" "}jako <span className="font-semibold text-foreground">{klaviyo.from_email}</span>
                </>
              ) : null}
              {klaviyo.default_list_id ? (
                <>
                  {" "}· lista <span className="font-semibold text-foreground">{klaviyo.default_list_id}</span>
                </>
              ) : null}
              . Możesz wkleić nowy klucz, aby go nadpisać.
            </p>
          )}
          <input
            type="password"
            autoComplete="off"
            placeholder="pk_xxx — Private API Key z Klaviyo"
            value={klaviyoKey}
            onChange={(e) => setKlaviyoKey(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="email"
              placeholder="Adres nadawcy (opcjonalnie)"
              value={klaviyoFrom}
              onChange={(e) => setKlaviyoFrom(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="ID domyślnej listy (opcjonalnie)"
              value={klaviyoList}
              onChange={(e) => setKlaviyoList(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Klucz utworzysz w{" "}
            <span className="font-semibold text-foreground">Klaviyo → Settings → API Keys → Private API Keys</span>. ID listy
            znajdziesz w <span className="font-semibold text-foreground">Lists &amp; Segments</span> (kolumna „List ID”).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={klaviyoBusy}
              onClick={() => void saveKlaviyo()}
              className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {klaviyo ? "Zapisz nowy klucz" : "Połącz Klaviyo"}
            </button>
            {klaviyo && (
              <>
                <button
                  disabled={klaviyoBusy}
                  onClick={() => void testKlaviyoSubscribe()}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                >
                  Dodaj siebie jako kontakt
                </button>
                <button
                  disabled={klaviyoBusy}
                  onClick={() => void testKlaviyoEvent()}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                >
                  Wyślij testowy event
                </button>
                <button
                  disabled={klaviyoBusy}
                  onClick={() => void disconnectKlaviyo()}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                >
                  Rozłącz
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-card p-5">
        <header className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Kalendarze (OAuth)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Połącz kalendarz, żeby planowane posty trafiały automatycznie do Twojego kalendarza.
            </p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <ProviderTile
            title="Google Calendar"
            status={cal?.google?.email}
            comingSoon={isMailCalendarComingSoon("google_calendar")}
            onConnect={() => connectGoogle("calendar")}
            onDisconnect={() => disconnectCal("google")}
          />
          <ProviderTile
            title="Outlook Calendar"
            status={cal?.outlook?.email}
            comingSoon={isMailCalendarComingSoon("outlook_calendar")}
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

function googleIntegrationOrigin(): string {
  if (typeof window === "undefined") return "https://marketingnow.site";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return window.location.origin;
  }
  if (host === "marketingnow.site" || host === "www.marketingnow.site") return "https://marketingnow.site";
  return "https://marketingnow.site";
}

function ProviderTile({
  title,
  status,
  comingSoon = false,
  onConnect,
  onDisconnect,
}: {
  title: string;
  status: string | null | undefined;
  comingSoon?: boolean;
  onConnect: (() => void) | null;
  onDisconnect: (() => void) | null;
}) {
  const connected = Boolean(status) && !comingSoon;
  return (
    <div className="rounded-lg border border-foreground/10 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">{title}</span>
        {comingSoon && !connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-600/20 px-2 py-0.5 text-[11px] font-semibold">
            Wkrótce
          </span>
        ) : connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-600/20 px-2 py-0.5 text-[11px] font-semibold">
            <Check className="h-3 w-3" /> połączone
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
            <X className="h-3 w-3" /> nie
          </span>
        )}
      </div>
      {comingSoon && !connected ? (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Integracja będzie dostępna <span className="font-semibold text-foreground">wkrótce</span>.
        </p>
      ) : null}
      {connected && <p className="mt-1 text-xs text-muted-foreground truncate">{status}</p>}
      <div className="mt-2 flex gap-1.5">
        {onConnect && !comingSoon && (
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