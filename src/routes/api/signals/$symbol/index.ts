import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signals/$symbol/")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { fetchSignalDocument } = await import("@/lib/scanner/engine.server");
        const doc = await fetchSignalDocument(params.symbol);
        if (!doc) return Response.json({ detail: "Sinyal bulunamadı" }, { status: 404 });
        return Response.json(doc);
      },
    },
  },
});