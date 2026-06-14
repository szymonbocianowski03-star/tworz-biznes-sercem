import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { isSupabaseSchemaMissingError } from "@/lib/supabaseSchemaHint";
import type { AiVisibilityReport } from "@/lib/aiVisibility/types";
import { normalizeStoredReport } from "@/lib/aiVisibility/reportNormalize";

function rowToReport(row: {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status: string;
  report: unknown;
}): AiVisibilityReport | null {
  try {
    const parsed =
      typeof row.report === "object" && row.report !== null
        ? (row.report as AiVisibilityReport)
        : (JSON.parse(String(row.report)) as AiVisibilityReport);
    return normalizeStoredReport({
      ...parsed,
      id: row.id,
      userId: row.user_id,
      createdAt: parsed.createdAt ?? row.created_at,
      updatedAt: parsed.updatedAt ?? row.updated_at,
      status: (row.status as AiVisibilityReport["status"]) ?? parsed.status ?? "saved",
    });
  } catch {
    return null;
  }
}

export async function fetchCloudReports(userId: string): Promise<{
  ok: boolean;
  reports: AiVisibilityReport[];
  schemaMissing?: boolean;
}> {
  const { data, error } = await supabase
    .from("llm_visibility_reports")
    .select("id, user_id, domain, brand_name, score, status, report, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return {
      ok: false,
      reports: [],
      schemaMissing: isSupabaseSchemaMissingError(error.message),
    };
  }

  const reports = (data ?? [])
    .map(rowToReport)
    .filter((r): r is AiVisibilityReport => r != null);

  return { ok: true, reports };
}

export async function upsertCloudReport(
  userId: string,
  report: AiVisibilityReport,
): Promise<{ ok: boolean; error?: string; schemaMissing?: boolean }> {
  const { error } = await supabase.from("llm_visibility_reports").upsert(
    {
      id: report.id,
      user_id: userId,
      domain: report.domain,
      brand_name: report.brandName,
      score: report.score,
      status: report.status,
      report: report as unknown as Json,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
    },
    { onConflict: "id" },
  );

  if (error) {
    return {
      ok: false,
      error: error.message,
      schemaMissing: isSupabaseSchemaMissingError(error.message),
    };
  }
  return { ok: true };
}

export async function deleteCloudReport(
  userId: string,
  reportId: string,
): Promise<{ ok: boolean; schemaMissing?: boolean }> {
  const { error } = await supabase
    .from("llm_visibility_reports")
    .delete()
    .eq("user_id", userId)
    .eq("id", reportId);

  if (error) {
    return { ok: false, schemaMissing: isSupabaseSchemaMissingError(error.message) };
  }
  return { ok: true };
}
