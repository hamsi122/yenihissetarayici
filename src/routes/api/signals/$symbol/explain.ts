import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/$symbol/explain")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { fetchSignalDocument, generateAiSummary, storeSignal } = await import(
          "@/lib/scanner/engine.server"
        );
        const doc = await fetchSignalDocument(params.symbol);
        if (!doc) return Response.json({ detail: "Sinyal bulunamadı" }, { status: 404 });
        const summary = await generateAiSummary(doc);
        const updated = { ...doc, ai_summary: summary, ai_summary_updated_at: new Date().toISOString() };
        await storeSignal(updated);
        return Response.json({ symbol: doc.symbol, summary, pattern_image_url: null });
      },
    },
  },
});