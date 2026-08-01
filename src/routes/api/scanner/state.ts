import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/scanner/state")({
  server: {
    handlers: {
      GET: async () => {
        const { getScannerState } = await import("@/lib/scanner/engine.server");
        const state = await getScannerState();
        return Response.json({
          running: state.running,
          last_run: state.last_run,
          last_error: state.last_error,
          last_duration_seconds: state.last_duration_seconds,
          last_scanned_count: state.last_scanned_count,
        });
      },
    },
  },
});