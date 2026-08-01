import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env["SUPABASE_PUBLISHABLE_KEY"]) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { getScannerState, runScanBatch } = await import("@/lib/scanner/engine.server");
        const state = await getScannerState();
        if (state.running) return Response.json({ status: "already_running" });
        const result = await runScanBatch();
        return Response.json({ status: "ok", ...result });
      },
    },
  },
});