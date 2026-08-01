import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/$symbol/auto-enrich")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { fetchSignalDocument, generateAiSummary, storeSignal } = await import(
          "@/lib/scanner/engine.server"
        );
        const { buildPatternImage } = await import("@/lib/scanner/pattern-image.server");
        const doc = await fetchSignalDocument(params.symbol);
        if (!doc) return Response.json({ detail: "Sinyal bulunamadı" }, { status: 404 });

        const record = doc as Record<string, any>;
        let summary = (record["ai_summary"] as string | null) ?? null;
        let patternImageUrl = (record["pattern_image_url"] as string | null) ?? null;
        let changed = false;

        if (!summary) {
          summary = await generateAiSummary(doc);
          record["ai_summary"] = summary;
          record["ai_summary_updated_at"] = new Date().toISOString();
          changed = true;
        }

        if (!patternImageUrl) {
          patternImageUrl = buildPatternImage(record);
          record["pattern_image_url"] = patternImageUrl;
          record["pattern_image_updated_at"] = new Date().toISOString();
          changed = true;
        }

        if (changed) await storeSignal(record as typeof doc);

        return Response.json({ symbol: doc.symbol, pattern_image_url: patternImageUrl, summary });
      },
    },
  },
});
