import { createFileRoute } from "@tanstack/react-router";
import { getSupabasePublicEnv } from "@/integrations/supabase/publicEnv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { claimQueuedLaunchJobs, processLaunchJob } from "@/modules/campaign-composer/launch/launch-engine";

/**
 * Worker HTTP dla kolejki Launch (Panel kampanii).
 * Zabezpiecz Bearer tokenem CAMPAIGN_LAUNCH_WORKER_SECRET (analogicznie do kolejki maili).
 */
export const Route = createFileRoute("/lovable/campaign-composer/queue/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CAMPAIGN_LAUNCH_WORKER_SECRET;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const url = getSupabasePublicEnv().url;
        if (!secret || !serviceKey || !url) {
          return Response.json({ error: "Brak konfiguracji worker / Supabase" }, { status: 500 });
        }
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const ids = await claimQueuedLaunchJobs(admin, 8);
        const results: { id: string; status: string }[] = [];
        for (const id of ids) {
          const r = await processLaunchJob(admin, id);
          results.push({ id, status: r.finalStatus });
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
