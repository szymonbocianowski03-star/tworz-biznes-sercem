import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractBrandColorsFromHtml } from "@/lib/extractBrandColors";

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
    return false;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/** Pobiera HTML strony i wyciąga kolory marki (bez zużycia kredytów AI). */
export const extractBrandColorsFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(3) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; colors: string[] } | { ok: false; message: string }> => {
    let pageUrl: string;
    try {
      const u = new URL(normalizeUrl(data.url));
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, message: "Dozwolone są tylko linki http/https." };
      }
      if (isBlockedHost(u.hostname)) {
        return { ok: false, message: "Ten adres nie może być pobrany." };
      }
      pageUrl = u.href;
    } catch {
      return { ok: false, message: "Nieprawidłowy adres URL." };
    }

    try {
      const res = await fetch(pageUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "MarketingNow-BrandColors/1.0 (+https://marketingnow.tech)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl,en;q=0.8",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        return { ok: false, message: `Strona zwróciła HTTP ${res.status}.` };
      }
      let html = (await res.text()).slice(0, 1_200_000);

      // Dołącz do 4 zewnętrznych CSS (kolory brandu często są tylko tam)
      // Preferuj arkusze z tej samej domeny — fonty Google zwykle nie mają kolorów marki.
      const cssCandidates: { href: string; sameOrigin: boolean }[] = [];
      const linkRe = /<link\b[^>]*>/gi;
      let lm: RegExpExecArray | null;
      const pageOrigin = new URL(pageUrl).origin;
      while ((lm = linkRe.exec(html)) !== null) {
        const tag = lm[0];
        if (!/rel=["'][^"']*stylesheet/i.test(tag)) continue;
        const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
        if (!href || href.startsWith("data:")) continue;
        try {
          const abs = new URL(href, pageUrl).href;
          if (cssCandidates.some((c) => c.href === abs)) continue;
          if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(abs)) continue;
          cssCandidates.push({ href: abs, sameOrigin: abs.startsWith(pageOrigin) });
        } catch {
          /* ignore */
        }
      }
      const cssHrefs = [
        ...cssCandidates.filter((c) => c.sameOrigin).map((c) => c.href),
        ...cssCandidates.filter((c) => !c.sameOrigin).map((c) => c.href),
      ].slice(0, 4);
      const cssChunks = await Promise.all(
        cssHrefs.map(async (href) => {
          try {
            const cr = await fetch(href, {
              redirect: "follow",
              headers: { Accept: "text/css,*/*;q=0.1", "User-Agent": "MarketingNow-BrandColors/1.0" },
              signal: AbortSignal.timeout(10_000),
            });
            if (!cr.ok) return "";
            return (await cr.text()).slice(0, 400_000);
          } catch {
            return "";
          }
        }),
      );
      if (cssChunks.some(Boolean)) {
        html += `\n<style>${cssChunks.filter(Boolean).join("\n")}</style>`;
      }

      const colors = extractBrandColorsFromHtml(html, 4);
      if (!colors.length) {
        return { ok: false, message: "Nie znaleziono kolorów na stronie." };
      }
      return { ok: true, colors };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Nie udało się pobrać kolorów.",
      };
    }
  });
