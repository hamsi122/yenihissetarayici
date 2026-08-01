import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/$symbol/visualize")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { fetchSignalDocument, storeSignal } = await import("@/lib/scanner/engine.server");
        const { buildPatternImage } = await import("@/lib/scanner/pattern-image.server");
        const doc = await fetchSignalDocument(params.symbol);
        if (!doc) return Response.json({ detail: "Sinyal bulunamadı" }, { status: 404 });
        const patternImageUrl = buildPatternImage(doc as Record<string, any>);
        await storeSignal({
          ...doc,
          pattern_image_url: patternImageUrl,
          pattern_image_updated_at: new Date().toISOString(),
        });
        return Response.json({ symbol: doc.symbol, pattern_image_url: patternImageUrl });
      },
    },
  },
});
