import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import DashboardPage from "@/pages/DashboardPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hisse Tarayıcı — Formasyon ve Sinyal Paneli" },
      {
        name: "description",
        content:
          "NASDAQ ve BIST hisseleri için formasyon tespiti, teknik sinyaller ve AI destekli açıklamalar sunan tarama paneli.",
      },
      { property: "og:title", content: "Hisse Tarayıcı — Formasyon ve Sinyal Paneli" },
      {
        property: "og:description",
        content: "Formasyon tespiti, teknik sinyaller ve AI destekli hisse analiz paneli.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="App min-h-screen bg-background text-foreground" data-testid="app-root-container">
      <ClientOnly fallback={null}>
        <DashboardPage />
      </ClientOnly>
      <Toaster position="top-right" />
    </div>
  );
}
