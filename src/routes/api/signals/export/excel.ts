import { createFileRoute } from "@tanstack/react-router";

type ExportBody = { markets?: string[]; actions?: string[] };

export const Route = createFileRoute("/api/signals/export/excel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildExportNote, estimateTargetDuration, signalLabel } = await import(
          "@/lib/scanner/signal.server"
        );
        const XLSX = await import("xlsx");

        const body = ((await request.json().catch(() => ({}))) ?? {}) as ExportBody;
        const marketMap: Record<string, string> = { NASDAQ: "US", US: "US", BIST: "BIST" };
        const actionMap: Record<string, string> = {
          "GÜÇLÜ AL": "GÜÇLÜ AL",
          "GÜÇLÜAL": "GÜÇLÜ AL",
          "GUÇLÜ AL": "GÜÇLÜ AL",
          "GÜÇLÜ SAT": "GÜÇLÜ SAT",
          "GÜÇLÜSAT": "GÜÇLÜ SAT",
          "GUÇLÜ SAT": "GÜÇLÜ SAT",
          AL: "AL",
          TUT: "TUT",
          SAT: "SAT",
        };

        const markets = (body.markets ?? [])
          .map((m) => marketMap[String(m).toUpperCase()])
          .filter((m): m is string => m === "US" || m === "BIST");
        const actions = (body.actions ?? [])
          .map((a) => actionMap[String(a).toUpperCase().trim()])
          .filter((a): a is string => Boolean(a));

        let query = supabaseAdmin
          .from("signals")
          .select("doc")
          .order("bullish_score", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(5000);
        if (markets.length) query = query.in("market", markets);
        if (actions.length) query = query.in("action", actions);

        const { data, error } = await query;
        if (error) return Response.json({ detail: error.message }, { status: 500 });

        const rows = (data ?? []).map((row) => {
          const doc = row.doc as Record<string, any>;
          const risk = (doc["risk"] ?? {}) as Record<string, unknown>;
          return {
            "Hisse Kodu": doc["symbol"],
            "Mevcut Sinyal": signalLabel(String(doc["action"] ?? "")),
            "Hedef Süresi": estimateTargetDuration(doc["patterns"] ?? [], String(doc["action"] ?? "")),
            "Take Profit": risk["take_profit"] ?? null,
            "Stop Loss": risk["stop_loss"] ?? null,
            "Analiz Notu": buildExportNote(doc),
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows, {
          header: ["Hisse Kodu", "Mevcut Sinyal", "Hedef Süresi", "Take Profit", "Stop Loss", "Analiz Notu"],
        });
        worksheet["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 36 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sinyaller");
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

        return new Response(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="sinyal_raporu.xlsx"',
          },
        });
      },
    },
  },
});