function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Czytelna strona HTML zamiast surowego tekstu przy błędach startu OAuth. */
export function oauthStartErrorResponse(
  status: 400 | 401 | 500,
  opts: {
    title: string;
    detail: string;
    hint?: string;
  },
): Response {
  const hint = opts.hint ? `<p class="hint">${escapeHtml(opts.hint)}</p>` : "";
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title>
<style>
:root { font-family: system-ui, "Segoe UI", sans-serif; line-height: 1.5; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f4f5; color: #18181b; padding: 24px; }
.card { max-width: 540px; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 28px 32px; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
h1 { font-size: 1.2rem; margin: 0 0 12px; font-weight: 650; }
p { margin: 0 0 12px; font-size: .95rem; color: #3f3f46; }
p.hint { font-size: .875rem; color: #71717a; }
code { font-size: .85em; background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }
ul { margin: 8px 0 0; padding-left: 1.25rem; color: #3f3f46; font-size: .9rem; }
footer { margin-top: 20px; font-size: .8rem; color: #a1a1aa; }
</style></head><body><div class="card">
<h1>${escapeHtml(opts.title)}</h1><p>${escapeHtml(opts.detail)}</p>${hint}<footer>Wróć do aplikacji i spróbuj ponownie.</footer>
</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
