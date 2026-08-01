import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/scanner/run")({
  server: {
    handlers: {
      POST: async () => {
        const { getScannerState, runScanBatch } = await import("@/lib/scanner/engine.server");
        const state = await getScannerState();
        if (state.running) return Response.json({ status: "already_running" });
        const result = await runScanBatch();
        return Response.json({
          status: "completed",
          message: `Tarama tamamlandı: ${result.scanned} hisse güncellendi.`,
          ...result,
        });
      },
    },
  },
});