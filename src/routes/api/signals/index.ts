import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = new URL(request.url);
        const market = url.searchParams.get("market") ?? "ALL";
        const action = url.searchParams.get("action") ?? "ALL";
        const search = url.searchParams.get("search")?.trim().toUpperCase() ?? "";
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 600) || 600, 1), 1200);

        let query = supabaseAdmin
          .from("signals")
          .select("doc")
          .order("bullish_score", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (market === "US" || market === "BIST") query = query.eq("market", market);
        if (action !== "ALL") query = query.eq("action", action);
        if (search) query = query.like("symbol", `${search}%`);

        const { data, error } = await query;
        if (error) return Response.json({ detail: error.message }, { status: 500 });
        return Response.json((data ?? []).map((row) => row.doc));
      },
    },
  },
});