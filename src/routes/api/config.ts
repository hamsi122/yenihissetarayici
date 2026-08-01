import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        const { MARKET_UNIVERSE, SCAN_INTERVAL_SECONDS } = await import("@/lib/scanner/universe");
        return Response.json({
          refresh_seconds: SCAN_INTERVAL_SECONDS,
          markets: { US: MARKET_UNIVERSE.US, BIST: MARKET_UNIVERSE.BIST },
          default_interval: "1d",
          data_source: "Yahoo Finance (US + BIST .IS)",
          llm_provider: "Lovable AI (Gemini 3 Flash)",
        });
      },
    },
  },
});