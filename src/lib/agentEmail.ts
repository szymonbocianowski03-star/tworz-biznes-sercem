export type MailDraft = { to: string; subject: string; body: string };

const MAIL_PATTERN = /\[MAIL:\s*([\s\S]*?)\]/i;

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function cleanRecipient(raw: string): string {
  const t = raw.trim().replace(/^[<"']|[>"']$/g, "").trim();
  return isValidEmail(t) ? t : "";
}

/** Wyciąga pierwszy marker [MAIL: odbiorca | temat | treść] z odpowiedzi asystenta. */
export function extractMailMarker(content: string): MailDraft | null {
  const m = content.match(MAIL_PATTERN);
  if (!m) return null;
  const inner = m[1] ?? "";
  const firstPipe = inner.indexOf("|");
  if (firstPipe === -1) {
    const body = inner.trim();
    return body ? { to: "", subject: "", body } : null;
  }
  const secondPipe = inner.indexOf("|", firstPipe + 1);
  if (secondPipe === -1) {
    return {
      to: cleanRecipient(inner.slice(0, firstPipe)),
      subject: inner.slice(firstPipe + 1).trim(),
      body: "",
    };
  }
  return {
    to: cleanRecipient(inner.slice(0, firstPipe)),
    subject: inner.slice(firstPipe + 1, secondPipe).trim(),
    body: inner.slice(secondPipe + 1).trim(),
  };
}

export function stripMailMarkers(content: string): string {
  return content
    .replace(new RegExp(MAIL_PATTERN.source, "gi"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Zamienia zwykły tekst maila na bezpieczny HTML (escape + zachowanie akapitów). */
export function mailBodyToHtml(body: string): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${esc.replace(
    /\n/g,
    "<br>",
  )}</div>`;
}
