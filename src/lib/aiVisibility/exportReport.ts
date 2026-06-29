import type { AiVisibilityReport } from "@/lib/aiVisibility/types";
import { t } from "@/lib/aiVisibility/translations";

function priorityLabel(value: string): string {
  const x = (value || "").toLowerCase();
  if (x.includes("high") || x.includes("wysok")) return "wysoki priorytet";
  if (x.includes("low") || x.includes("nisk")) return "niski priorytet";
  if (x.includes("medium") || x.includes("średn") || x.includes("sredn")) return "średni priorytet";
  return value;
}

export function copyReportSummary(report: AiVisibilityReport): string {
  return [report.executiveSummary, "", report.topActions.map((a, i) => `${i + 1}. ${a}`).join("\n")].join("\n");
}

/** Eksport PDF przez okno druku — profesjonalny układ HTML bez zewnętrznej biblioteki. */
export function exportReportPdf(report: AiVisibilityReport): void {
  const tr = t();
  const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><title>${escapeHtml(tr.aiVisibilityTitle)} — ${escapeHtml(report.brandName)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.5}
  h1{font-size:28px;margin-bottom:8px} h2{font-size:18px;margin-top:32px;border-bottom:1px solid #e5e5e5;padding-bottom:6px}
  .meta{color:#555;font-size:14px;margin-bottom:24px}
  .score{font-size:48px;font-weight:800;margin:16px 0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
  .card{border:1px solid #e5e5e5;border-radius:8px;padding:12px}
  .card strong{display:block;font-size:11px;text-transform:uppercase;color:#666}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
  th,td{border:1px solid #e5e5e5;padding:8px;text-align:left}
  th{background:#f5f5f5}
  @media print{body{margin:20px}}
</style></head><body>
  <h1>${escapeHtml(tr.aiVisibilityTitle)}</h1>
  <p class="meta">${escapeHtml(report.brandName)} · ${escapeHtml(report.domain)} · ${escapeHtml(new Date(report.createdAt).toLocaleString("pl-PL"))}</p>
  <div class="score">${escapeHtml(String(report.score))}<span style="font-size:18px;font-weight:600;color:#666"> / 100</span></div>
  <p><strong>${escapeHtml(report.statusLabel)}</strong></p>
  <h2>${tr.executiveSummary}</h2>
  <p>${escapeHtml(report.executiveSummary)}</p>
  <h2>${tr.metrics}</h2>
  <div class="grid">
    <div class="card"><strong>${escapeHtml(tr.visibilityInQueries)}</strong>${escapeHtml(String(report.metrics.visibilityInQueries))}%</div>
    <div class="card"><strong>${escapeHtml(tr.mentionsWithSources)}</strong>${escapeHtml(String(report.metrics.mentionsWithSources))}</div>
    <div class="card"><strong>${escapeHtml(tr.aiShareOfVoice)}</strong>${escapeHtml(String(report.metrics.aiShareOfVoice))}%</div>
    <div class="card"><strong>${escapeHtml(tr.analyzedQueries)}</strong>${escapeHtml(String(report.metrics.totalQueries))}</div>
  </div>
  <h2>${tr.queriesTable}</h2>
  <table><thead><tr><th>${tr.query}</th><th>${tr.model}</th><th>${tr.brandAppeared}</th><th>${tr.comment}</th></tr></thead><tbody>
  ${report.analyzedQueries
    .map(
      (q) =>
        `<tr><td>${escapeHtml(q.query)}</td><td>${escapeHtml(q.model)}</td><td>${q.brandMentioned ? tr.yes : tr.no}</td><td>${escapeHtml(q.comment)}</td></tr>`,
    )
    .join("")}
  </tbody></table>
  <h2>${tr.recommendations}</h2>
  ${report.recommendations
    .map(
      (r, i) =>
        `<p><strong>${i + 1}. ${escapeHtml(r.title)}</strong> (${escapeHtml(priorityLabel(r.priority))})<br/>${escapeHtml(r.howToFix)}</p>`,
    )
    .join("")}
  <h2>${tr.thirtyDayPlan}</h2>
  <p><strong>${tr.week1}</strong></p><ul>${report.thirtyDayPlan.week1.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
  <p><strong>${tr.week2}</strong></p><ul>${report.thirtyDayPlan.week2.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
