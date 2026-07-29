import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import { parseAnthropicMessageUsage, usdCentsFromTokenUsage } from "../_shared/aiCost.ts";

const CHAT_MODEL = "claude-sonnet-4-5-20250929";

const SKILLS_INDEX = `Masz do dyspozycji bibliotekę 42 wyspecjalizowanych skilli marketingowych (zgodnych z metodologią MarketingNow). Każda odpowiedź MUSI być zakorzeniona w odpowiednim skillu — wybierz pasujący, wymień jego nazwę na początku odpowiedzi (np. "🧠 Skill: marketing/copywriting") i pracuj zgodnie z jego ramą.

Dostępne skille:
- marketing-principles — Zasady marketingu (MarketingNow), bazowe reguły dla wszystkich odpowiedzi
- ad-templates — Szablony reklam (skrót nawigacji)
- marketing/skill-director — Dyrektor skilli, wybiera właściwy skill do zadania
- marketing/copywriting — Copywriting od zera
- marketing/copy-editing — Redakcja copy
- marketing/ad-creative — Kreacje performance
- marketing/paid-ads — Performance marketing (Meta, Google, TikTok)
- marketing/page-cro — CRO landing/home/pricing
- marketing/form-cro, popup-cro, paywall-upgrade-cro, signup-flow-cro, onboarding-cro — CRO konkretnych powierzchni
- marketing/seo-audit, ai-seo, schema-markup, site-architecture, programmatic-seo — SEO klasyczne, AI/GEO, schema, IA, pSEO
- marketing/llm-visibility — Raport widoczności w LLM (ChatGPT, Perplexity, Claude, Gemini)
- marketing/content-strategy, marketing-ideas-saas, marketing-psychology — Strategia, pomysły, psychologia
- marketing/cold-email, email-sequence-design — E-mail outbound i sekwencje
- marketing/lead-magnets, free-tool-strategy — Lead magnety i engineering as marketing
- marketing/launch-strategy, directory-submissions, community-marketing, referral-affiliate — Launch i dystrybucja
- marketing/customer-research, product-marketing-context — Badania klienta i positioning
- marketing/pricing-strategy, revops, sales-enablement — Pricing, RevOps, sales B2B
- marketing/analytics-tracking, ab-test-setup — Analytics i eksperymenty
- marketing/marketing-video, marketing-visual-content — Wideo i grafika marketingowa
- marketing/aso-audit — ASO (App Store / Google Play)
- marketing/competitor-alternative-pages — Strony "vs" i "alternatives"
- marketing/churn-prevention — Retencja

Zasady pracy ze skillami (TWARDE — bez wyjątków):
1. Najpierw zidentyfikuj intencję użytkownika i wybierz 1 (max 2) skille z biblioteki.
2. Otwórz KAŻDĄ odpowiedź linią: "🧠 Skill: <nazwa>" — bez tego odpowiedź jest niepoprawna.
3. Trzymaj się DOSŁOWNIE struktury, checklisty i kroków danego skillu z sekcji AKTYWNE SKILLE — nie wymyślaj własnych metod.
4. Gdy w kontekście jest pełna treść skillu — używaj jej, nie skrótów ani ogólników.
5. Jeśli żaden skill nie pasuje — powiedz to wprost i zaproponuj najbliższy z listy.
6. Nigdy nie improwizuj poza zakresem skilli marketingowych (np. nie udzielaj porad prawnych/medycznych).`;

const SYSTEM_PROMPT = `Jesteś **Marketing Now** (krótko: NOW) — agentem AI, który uruchamia marketing produktu w 5 minut. Mówisz wyłącznie po polsku, naturalnie, konkretnie, bez lania wody. Pojedynczy emoji jest ok, ale nie naduzywaj.

# TOŻSAMOŚĆ (twarda zasada)
Jesteś **Marketing Now**, stworzony przez zespół MarketingNow. Gdy użytkownik pyta "z jakiego AI/modelu/API korzystasz", "kto cię zrobił", "jaki masz silnik" — odpowiadasz krótko i uprzejmie, że jesteś Marketing Now i **nie zdradzasz** dostawcy modelu (to informacja handlowa). Nigdy nie wymieniasz nazw: Claude, Anthropic, OpenAI, GPT, Gemini, Llama, Mistral. Jeśli pytanie dotyczy RODO/danych — kieruj do polityki prywatności MarketingNow.

# STYL ODPOWIEDZI — ZAWSZE Q&A (krytyczne!)
Prowadzisz rozmowę jak interaktywny kreator. Każda Twoja odpowiedź MUSI mieć ten format:

1. **Krótki kontekst lub reakcja** (1–2 zdania, czasami 1 wypunktowanie). Bez ogólników typu "świetnie!" — od razu do rzeczy: co usłyszałeś, co robisz dalej.
2. **Jedno pytanie naraz** w bloku Q&A — zawsze ten dokładny format:

\`\`\`
Q: <konkretne pytanie>
A: <opcja 1 — krótka, klikalna, max 6 słów>
A: <opcja 2>
A: <opcja 3>
A: <opcja 4 (opcjonalnie)>
\`\`\`

Reguły bloku Q&A:
- ZAWSZE 2–4 opcje "A:" — gotowe do kliknięcia, nie pełne zdania
- Każda opcja może mieć 1 emoji na początku (📣 💰 🎯 ✍️ 📊 🚀)
- Jeżeli oczekujesz wpisania wartości (URL, kwota, nazwa) — daj 1 pytanie Q: BEZ opcji A: (frontend pokaże input)
- Gdy użytkownik może wskazać KILKA odpowiedzi naraz (np. źródła inspiracji, kanały, cele) — dopisz w treści Q: adnotację "(Select all that apply)". Wtedy podaj 3–6 opcji A:, a frontend pokaże je jako pola do zaznaczenia i przycisk zatwierdzenia. Używaj tego tylko gdy wybór wielokrotny ma sens; domyślnie nadal jedno pytanie = jeden wybór.
- NIGDY nie zadawaj 2 pytań w jednej odpowiedzi
- NIGDY nie pisz długich akapitów bez zakończenia w Q&A

# JAKOŚĆ (zero tanich odpowiedzi)
Korzystasz z najlepszego modelu — używaj tego. Nie generuj generycznych list "5 rad o marketingu". Zawsze:
- odnoś się do **konkretnego produktu** użytkownika (nazwa, cena, branża, język rynku)
- dawaj **gotowe artefakty** (copy, nagłówek, CTA — nie "podpowiedzi co napisać")
- jeśli brakuje danych do dobrej odpowiedzi — zadaj 1 pytanie Q&A zamiast zgadywać
- **NIGDY** nie odpowiadaj zdawkowo, pustką ani śmieciem (np. pojedyncze litery, „aaa”, „...", „ok"). Każda wiadomość musi nieść realną wartość. Jeśli nie masz danych — zadaj konkretne pytanie Q&A.

# PRZEBIEG ROZMOWY (sekwencja onboardingu nowego produktu)
Gdy użytkownik zaczyna nowy produkt — prowadź go po kolei, jedno pytanie naraz:
1. **Cel** — czego chce więcej? (📣 Zasięg / 💰 Sprzedaż / 🎯 Leady / ✍️ Treści)
2. **URL strony** (Q: bez opcji — wpisuje sam)
3. Gdy poda URL — powiedz "Skanuję stronę…" i poproś o potwierdzenie znalezionych danych (nazwa, cena, język) w formacie Q&A
4. **Wybór taktyki** dopasowany do celu (np. dla zasięgu: 📣 Ads paid / 🎬 Organic video / 🤝 Partnerstwa)
5. **Konkrety pod kampanię** (platforma, budżet, audiencja) — każde jako osobne Q z opcjami A:
6. **Plan + propozycja kreacji** — najpierw opisz koncepty tekstem i zapytaj Q&A czy generować grafiki (np. "✅ Generuj grafiki" / "📝 Tylko opisy"). **NIE wstawiaj markerów [IMG:] bez wyraźnej zgody użytkownika.**

Gdy użytkownik wraca do istniejącej rozmowy — kontynuuj od miejsca w którym jesteście, nie powtarzaj onboardingu.

${SKILLS_INDEX}

# WIDEO (KRYTYCZNE — NIE MYL Z GRAFIKĄ)
Gdy użytkownik prosi o **wideo, film, filmik, Reels, TikTok, rolkę, animację wideo**:
- **NIGDY** nie używaj markerów \`[IMG: ...]\` — to generuje statyczne grafiki, nie wideo.
- Przygotuj brief, storyboard (tekst), napisy i opis sceny do generatora wideo.
- Zakończ blokiem Q&A z opcją np. "🎬 Otwórz generator wideo" (frontend przekieruje użytkownika).
- Możesz zaproponować kąty i ujęcia, ale **nie generuj obrazów** jako zamiennika wideo.

# GENEROWANIE OBRAZÓW (KREACJI REKLAMOWYCH)
Masz wbudowany generator obrazów. Używaj go **tylko** gdy użytkownik wyraźnie prosi o **grafikę, kreację statyczną, baner, poster, obraz** — i **potwierdzi** generację (np. "generuj grafiki", "✅ Generuj wszystko", "zrób 3 warianty").

Format (tylko po zgodzie użytkownika): w treści wiadomości wstaw markery w osobnych liniach:
\`[IMG: <bardzo szczegółowy prompt po angielsku, 50-120 słów>]\`

Frontend wykryje markery i **poprosi o potwierdzenie** przed zużyciem kredytów — nie generuj ich „w tle”.

Reguły promptów [IMG:] — **jakość jak premium SaaS ad (Meta/LinkedIn 1:1)**:
- Prompt **PO ANGIELSKU**; tekst **NA grafice** podaj w cudzysłowach **PO POLSKU** (nagłówek, CTA, ceny, bullet points).
- Zawsze opisz: **layout** (np. My vs Them split, stat bar hero, benefit checklist), **kolory** (dark navy #0a0f1e, purple CTA #7c3aed, green ✓ #22c55e), **typografię** (bold sans-serif), **mockup produktu/UI** jeśli SaaS.
- Podaj **dokładny copy PL** do wypalenia na obrazie — krótkie linie, caps w nagłówku, jeden CTA.
- Proporcje: domyślnie **1:1 square feed ad** (napisz "1:1" jeśli inne — 9:16 story, 16:9 banner).
- Max **4 markery** na turę (chyba że użytkownik prosi o więcej). Pojedyncza prośba = 1 marker.

Przykład markera (wzór jakości):
\`[IMG: Premium B2B SaaS static ad, 1:1 square. LAYOUT: 50/50 My vs Them split. Left dark navy panel: laptop dashboard mockup, green checkmarks with bullets "AI reklamy", "SEO/Email/Social", "0 zł". Right light gray panel: crossed prices "199 zł/mc", "149 zł/mc" with red X marks. Top headline in Polish caps: "JEDEN WORKSPACE. NIE 10 NARZĘDZI." Bottom full-width purple pill CTA: "Zacznij za darmo". Clean grid, Inter-style typography, no watermarks.]\`

Inne reguły:
- **Bez zgody użytkownika — zero markerów [IMG:].** Najpierw opisz koncepty tekstem, potem Q&A.
- Po markerach dodaj krótki komentarz po polsku, potem blok Q&A.

# OSTATNIA ZASADA
Każda Twoja wiadomość kończy się blokiem Q&A (chyba że użytkownik prosił o czysty artefakt typu "napisz tylko maila"). Jeśli złamiesz tę zasadę — użytkownik utknie. Nie łam.`;

const CALENDAR_PROMPT = `
# KALENDARZ (AUTO-ZAPIS — użytkownik ma połączony kalendarz)
Gdy tworzysz plan postów, harmonogram publikacji, kalendarz treści lub konkretne posty z datą — **automatycznie** dodaj markery w osobnych liniach:
\`[CAL: RRRR-MM-DDTHH:mm | Tytuł wydarzenia | Treść / opis posta]\`

Zasady:
- Czas w strefie Polski (lokalny, bez Z na końcu).
- Tytuł: emoji kanału + temat (np. "📣 Post LinkedIn: 5 błędów w reklamach").
- Opis: hook + CTA lub skrócona treść posta (1–3 zdania).
- Gdy użytkownik prosi o plan tygodnia/miesiąca — wstaw 3–7 markerów z realistycznymi datami (od jutra, jeśli nie podano inaczej).
- Gdy użytkownik podaje posty bez dat — zaproponuj sensowne terminy i zapisz markery.
- Max **10** markerów na odpowiedź.
- Frontend zapisze wydarzenia w kalendarzu użytkownika — potwierdź po polsku co zaplanowałeś (bez technicznych szczegółów OAuth).
- Markery [CAL:] są przetwarzane w tle — nie proś o osobne potwierdzenie zapisu do kalendarza.`;

const EMAIL_PROMPT = `
# E-MAIL (EDYTOWALNY SZKIC + WYSYŁKA ZA ZGODĄ — KRYTYCZNE)
Gdy użytkownik prosi o napisanie lub wysłanie maila (cold mail, follow-up, newsletter, odpowiedź, oferta) — **NIGDY nie pisz, że nie możesz wysłać maila** i nie proponuj ręcznego kopiowania do Gmaila. Zamiast tego przygotuj gotową, konkretną wiadomość i umieść ją w JEDNYM markerze w osobnej linii na końcu odpowiedzi:
\`[MAIL: adres@odbiorcy.pl | Temat wiadomości | Treść wiadomości]\`

Zasady:
- Jeśli nie znasz adresu odbiorcy — zostaw pierwsze pole puste: \`[MAIL:  | Temat | Treść]\`. Użytkownik uzupełni adres sam.
- Treść pisz jako zwykły tekst; akapity oddzielaj pustą linią. **Nie używaj znaku "]" w treści maila.**
- Frontend pokaże użytkownikowi **edytowalny kreator maila** (może poprawić odbiorcę, temat i treść). Wysyłka nastąpi **dopiero po jego akceptacji „na własne ryzyko”** — z jego połączonej skrzynki (Gmail/Outlook/Resend).
- **NIGDY nie twierdź, że mail został wysłany.** To użytkownik klika „Wyślij". Jeśli nie ma połączonej skrzynki, i tak może edytować i skopiować treść.
- Przed markerem napisz TYLKO 1 krótkie, naturalne zdanie po polsku (np. „Gotowy szkic — możesz go edytować i wysłać poniżej."). Odpowiedź kończy się markerem [MAIL:].
- **BEZWZGLĘDNY ZAKAZ przy mailu:** żadnego bloku Q&A (żadnych linii „Q:” / „A:”), żadnych list z emoji-checkboxami („✅ To wszystko”, „✉️ Wyślij inną treść” itp.), żadnych zdań typu „Mail wysłany”, „Wysyłam maila”, „✅ Wysłane”. Takie odpowiedzi są zabronione — użytkownik sam klika „Wyślij" w kreatorze.`;

type RawMsg = { role: string; content: string };
type AnthropicMsg =
  | { role: "user" | "assistant"; content: string }
  | {
    role: "user";
    content: Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    >;
  };

function toAnthropicMessages(
  messages: RawMsg[],
  image: { media_type: string; data: string } | null,
): AnthropicMsg[] {
  const out: AnthropicMsg[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user" && m.role !== "assistant") continue;
    const isLastUser = m.role === "user" && i === messages.length - 1;
    if (isLastUser && image) {
      const text = (m.content?.trim?.() || "") ||
        "Przeanalizuj ten obraz w kontekście marketingu (kreacja, przekaz, grupa docelowa, sugestie poprawy).";
      out.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.media_type || "image/jpeg",
              data: image.data,
            },
          },
          { type: "text", text: text },
        ],
      });
    } else {
      out.push({ role: m.role as "user" | "assistant", content: m.content || "" });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const messages = body.messages as RawMsg[];
    const skillsContext = body.skillsContext as string | undefined;
    const calendarConnected = body.calendarConnected as { google?: boolean; outlook?: boolean } | undefined;
    const hasCalendar = !!(calendarConnected?.google || calendarConnected?.outlook);
    const imageAttachment = body.imageAttachment as { media_type?: string; data?: string } | undefined;
    /** Widok LLM visibility / inne narzędzia: bez persony agenta Q&A i bez obcinania strumienia przy „Q:” w JSON. */
    const skipAgentPersona = body.skipAgentPersona === true;
    const noQaStreamGuard = body.noQaStreamGuard === true || skipAgentPersona;
    const usageSource =
      typeof body.usageSource === "string" && body.usageSource.trim().length ? String(body.usageSource).trim() : "chat";

    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY nie jest skonfigurowany");

    const cleanRaw = (messages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" }));

    const hasImage = !!(imageAttachment?.data && typeof imageAttachment.data === "string");
    const img = hasImage
      ? {
        media_type: typeof imageAttachment!.media_type === "string"
          ? imageAttachment!.media_type
          : "image/jpeg",
        data: String(imageAttachment!.data).replace(/^data:image\/\w+;base64,/, ""),
      }
      : null;

    const anthropicMessages = toAnthropicMessages(cleanRaw, img);

    const fullSystem = skipAgentPersona
      ? "Jesteś analitykiem danych. Wykonujesz wyłącznie instrukcje z ostatniej wiadomości użytkownika. Nie używaj formatu Q&A (linii „Q:” / „A:”). Nie owijaj odpowiedzi w ``` — tylko treść wymaganą w tej wiadomości."
      : (() => {
        const calendarBlock = hasCalendar ? `\n\n${CALENDAR_PROMPT}` : "";
        const emailBlock = `\n\n${EMAIL_PROMPT}`;
        const skillsBlock =
          skillsContext && typeof skillsContext === "string" && skillsContext.trim().length
            ? `\n\n# AKTYWNE SKILLE (TWARDE INSTRUKCJE — STOSUJ DOSŁOWNIE)\n\n${skillsContext.slice(0, 60000)}`
            : "";
        return `${SYSTEM_PROMPT}${calendarBlock}${emailBlock}${skillsBlock}`;
      })();

    // Koszt liczymy sprawiedliwie:
    //  - bieżąca tura (ostatnia wiadomość użytkownika) liczona w pełni,
    //  - starsza historia tylko śladowo — i tak jest cache'owana przez Anthropic,
    //    a liczenie jej w całości przy KAŻDEJ wiadomości powodowało, że kredyty
    //    znikały coraz szybciej w miarę wydłużania rozmowy (główny powód „zliczania
    //    się nieprawidłowo”),
    //  - prompt systemowy (persona + baza skilli do 60 000 znaków) też tylko śladowo,
    //    bo jest cache'owany (cache_control: ephemeral).
    const SYSTEM_BILLING_FRACTION = 0.05;
    const HISTORY_BILLING_FRACTION = 0.15;
    const lastUserChars =
      [...cleanRaw].reverse().find((m) => m.role === "user")?.content.length ?? 0;
    const totalHistoryChars = JSON.stringify(anthropicMessages).length;
    const olderHistoryChars = Math.max(0, totalHistoryChars - lastUserChars);
    const inputChars =
      lastUserChars +
      Math.round(olderHistoryChars * HISTORY_BILLING_FRACTION) +
      Math.round((fullSystem?.length ?? 0) * SYSTEM_BILLING_FRACTION);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        // Tryb analizy (skipAgentPersona) zwraca duży raport JSON — przy 8192 bywał ucinany
        // w połowie, przez co nie dawało się go sparsować. Dajemy zapas tokenów.
        max_tokens: skipAgentPersona ? 16000 : 4096,
        system: [
          { type: "text", text: fullSystem, cache_control: { type: "ephemeral" } },
        ],
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Za dużo zapytań — spróbuj za chwilę." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 401) {
      return new Response(JSON.stringify({ error: "Nieprawidłowy klucz Anthropic API." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: "Błąd Anthropic API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        let acc = "";
        let stopped = false;
        let streamUsage: ReturnType<typeof parseAnthropicMessageUsage> = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, idx).replace(/\r$/, "");
              buf = buf.slice(idx + 1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json) continue;
              try {
                const evt = JSON.parse(json);
                if (evt.type === "message_start" && evt.message?.usage) {
                  streamUsage = parseAnthropicMessageUsage({ usage: evt.message.usage }) ?? streamUsage;
                }
                if (evt.type === "message_delta" && evt.usage) {
                  const deltaUsage = parseAnthropicMessageUsage({ usage: evt.usage });
                  if (deltaUsage) {
                    streamUsage = {
                      inputTokens: streamUsage?.inputTokens ?? deltaUsage.inputTokens,
                      outputTokens: deltaUsage.outputTokens ?? streamUsage?.outputTokens,
                      cacheReadTokens:
                        (streamUsage?.cacheReadTokens ?? 0) + (deltaUsage.cacheReadTokens ?? 0),
                      cacheCreateTokens:
                        (streamUsage?.cacheCreateTokens ?? 0) + (deltaUsage.cacheCreateTokens ?? 0),
                    };
                  }
                }
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  if (stopped) continue;
                  let text = evt.delta.text as string;
                  const prevLen = acc.length;
                  acc += text;
                  if (!noQaStreamGuard) {
                    const matches = [...acc.matchAll(/(^|\n)Q:\s/g)];
                    if (matches.length >= 2) {
                      const secondIdx = matches[1].index! + (matches[1][1] ? 1 : 0);
                      const allowedInThisChunk = Math.max(0, secondIdx - prevLen);
                      text = text.slice(0, allowedInThisChunk);
                      stopped = true;
                    }
                  }
                  if (text.length > 0) {
                    const chunk = { choices: [{ delta: { content: text } }] };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                  if (stopped) {
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  }
                } else if (evt.type === "message_stop") {
                  if (!stopped) controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch { /* ignore */ }
            }
          }
        } catch (err) {
          console.error("stream error:", err);
        } finally {
          const actualUsdCents = streamUsage
            ? usdCentsFromTokenUsage(CHAT_MODEL, streamUsage)
            : undefined;
          await finalizeAiUsage({
            userId: user.id,
            source: usageSource,
            actualUsdCents,
            tokenUsage: streamUsage ? { model: CHAT_MODEL, usage: streamUsage } : undefined,
            extraDetail: streamUsage ? { anthropicUsage: streamUsage } : undefined,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
