import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/$symbol/reanalyze")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { analyzeSymbol, fetchSignalDocument } = await import("@/lib/scanner/engine.server");
        const doc = (await analyzeSymbol(params.symbol)) ?? (await fetchSignalDocument(params.symbol));
        if (!doc) return Response.json({ detail: "Sinyal bulunamadı" }, { status: 404 });
        return Response.json(doc);
      },
    },
  },
});