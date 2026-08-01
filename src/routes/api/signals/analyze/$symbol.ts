import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/analyze/$symbol")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { analyzeSymbol, generateAiSummary, storeSignal } = await import(
          "@/lib/scanner/engine.server"
        );
        let doc;
        try {
          doc = await analyzeSymbol(params.symbol);
        } catch (error) {
          return Response.json(
            { detail: error instanceof Error ? error.message : String(error) },
            { status: 500 },
          );
        }
        if (!doc) {
          return Response.json({ detail: "Bu sembol için veri alınamadı" }, { status: 404 });
        }
        const summary = await generateAiSummary(doc);
        const enriched = { ...doc, ai_summary: summary, ai_summary_updated_at: new Date().toISOString() };
        await storeSignal(enriched);
        return Response.json(enriched);
      },
    },
  },
});