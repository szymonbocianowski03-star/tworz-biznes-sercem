import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/linkedin/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";

        if (!token) {
          return Response.json({ error: "missing_session" }, { status: 401 });
        }

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) {
          return Response.json({ error: "invalid_session" }, { status: 401 });
        }

        const { error } = await supabaseAdmin
          .from("linkedin_connections")
          .delete()
          .eq("user_id", userData.user.id);

        if (error) {
          console.error("[linkedin disconnect]", error);
          return Response.json({ error: "disconnect_failed" }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
