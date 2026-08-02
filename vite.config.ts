import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const preset = process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : undefined);

export default defineConfig({
  ...(preset ? { nitro: { preset } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Standart Vite performans ve parça (chunk) ayarlarını buraya ekliyoruz:
  vite: {
    build: {
      chunkSizeWarningLimit: 1000, // 500 kB uyarı sınırını 1 MB'a çıkarır
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("recharts")) {
                return "vendor-recharts";
              }
              if (id.includes("react") || id.includes("scheduler")) {
                return "vendor-react";
              }
              return "vendor";
            }
          },
        },
      },
    },
  },
});
