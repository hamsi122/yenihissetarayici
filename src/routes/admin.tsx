import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminCreate, adminDashboard, adminLogin, adminLogout, adminMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Yönetim Paneli — Hisse Tarayıcı" },
      { name: "description", content: "Ziyaretçi istatistikleri, hata kayıtları ve formasyon isabet oranı paneli." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Yönetim Paneli — Hisse Tarayıcı" },
      { property: "og:description", content: "Hisse Tarayıcı yönetici analiz paneli." },
    ],
  }),
  component: AdminPage,
});

const StatCard = ({ label, value, hint, testId }: { label: string; value: any; hint?: string; testId: string }) => (
  <Card className="border-border/70 bg-card/50" data-testid={testId}>
    <CardHeader className="p-4 pb-1">
      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <p className="font-mono text-2xl font-black text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </CardContent>
  </Card>
);

function AdminPage() {
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const me = useServerFn(adminMe);
  const dashboard = useServerFn(adminDashboard);
  const createAdminFn = useServerFn(adminCreate);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "" });
  const [adminMessage, setAdminMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const result = await dashboard();
      setData(result);
      setCurrentUser(result.username);
      setAuthed(true);
    } catch {
      setAuthed(false);
    }
  }, [dashboard]);

  useEffect(() => {
    (async () => {
      const session = await me();
      if (session.username) await loadDashboard();
    })();
  }, [me, loadDashboard]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login({ data: { username, password } });
      if (!result.ok) {
        setError("Kullanıcı adı veya şifre hatalı.");
        return;
      }
      setPassword("");
      await loadDashboard();
    } catch {
      setError("Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthed(false);
    setData(null);
  };

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdminMessage("");
    try {
      const result = await createAdminFn({ data: newAdmin });
      setData((prev: any) => (prev ? { ...prev, admins: result.admins } : prev));
      setNewAdmin({ username: "", password: "" });
      setAdminMessage("Yeni admin eklendi.");
    } catch (err: any) {
      setAdminMessage(err?.message || "Admin eklenemedi.");
    }
  };

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4" data-testid="admin-login-page">
        <Card className="w-full max-w-sm border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="font-heading text-xl font-black">Admin Paneli Girişi</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleLogin} data-testid="admin-login-form">
              <div className="space-y-1">
                <Label htmlFor="admin-username">Kullanıcı Adı</Label>
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  data-testid="admin-username-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-password">Şifre</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="admin-password-input"
                />
              </div>
              {error ? <p className="text-sm text-destructive" data-testid="admin-login-error">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy} data-testid="admin-login-submit">
                {busy ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const stats = data?.stats;
  const accuracy = stats?.accuracy;
  const scanner = stats?.scanner;
  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("tr-TR") : "—");

  return (
    <main className="min-h-screen space-y-5 bg-background p-4 text-foreground md:p-6" data-testid="admin-dashboard-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-black">Yönetim Paneli</h1>
          <p className="text-sm text-muted-foreground">
            Giriş yapan: <span className="font-mono">{currentUser}</span> · Panel yalnızca izleme amaçlıdır, site ayarları
            değiştirilemez.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} data-testid="admin-logout-button">
          Çıkış Yap
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="admin-stats-grid">
        <StatCard
          label="Günlük Giriş"
          value={stats?.page_views_today ?? 0}
          hint={`Bugün tekil ziyaretçi: ${stats?.unique_visitors_today ?? 0}`}
          testId="admin-stat-views-today"
        />
        <StatCard
          label="Toplam Giriş"
          value={stats?.page_views_total ?? 0}
          hint={`Son 24s: ${stats?.page_views_24h ?? 0} · 7g: ${stats?.page_views_7d ?? 0}`}
          testId="admin-stat-total-views"
        />
        <StatCard label="Tekil Ziyaretçi (30g)" value={stats?.unique_visitors_30d ?? 0} testId="admin-stat-unique" />
        <StatCard label="Hata Kaydı" value={stats?.error_count ?? 0} hint={`İzlenen sinyal: ${stats?.signals_tracked ?? 0}`} testId="admin-stat-errors" />
      </section>

      <Card className="border-border/70 bg-card/50" data-testid="admin-country-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Ülkelere Göre Giriş Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {(stats?.countries?.items ?? []).map((row: any) => (
            <div key={row.code} className="space-y-1" data-testid={`admin-country-row-${row.code}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {row.name} <span className="text-muted-foreground">({row.code})</span>
                </span>
                <span className="font-mono text-muted-foreground">
                  %{row.pct} · {row.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted/40">
                <div className="h-full rounded-sm bg-primary" style={{ width: `${Math.min(100, row.pct)}%` }} />
              </div>
            </div>
          ))}
          {!(stats?.countries?.items ?? []).length ? (
            <p className="text-xs text-muted-foreground">Henüz ülke verisi toplanmadı.</p>
          ) : null}
        </CardContent>
      </Card>


      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/50 lg:col-span-2" data-testid="admin-scan-card">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base" data-testid="admin-scan-health-title">Tarama Sağlığı ve Günlük Kapsamlı Tarama</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              <div className="rounded-sm border border-border/60 p-2">
                <p className="text-muted-foreground">Durum</p>
                <p className="font-mono text-sm" data-testid="admin-scan-status">
                  {scanner?.running ? "Tarama sürüyor" : "Beklemede"}
                </p>
              </div>
              <div className="rounded-sm border border-border/60 p-2">
                <p className="text-muted-foreground">Son Tarama</p>
                <p className="font-mono text-sm" data-testid="admin-scan-last-run">{formatDate(scanner?.last_run)}</p>
              </div>
              <div className="rounded-sm border border-border/60 p-2">
                <p className="text-muted-foreground">Taranan Hisse</p>
                <p className="font-mono text-sm" data-testid="admin-scan-count">{scanner?.last_scanned_count ?? 0}</p>
              </div>
              <div className="rounded-sm border border-border/60 p-2">
                <p className="text-muted-foreground">Süre</p>
                <p className="font-mono text-sm" data-testid="admin-scan-duration">
                  {scanner?.last_duration_seconds ? `${Math.round(scanner.last_duration_seconds)} sn` : "—"}
                </p>
              </div>
            </div>
            {scanner?.last_error ? (
              <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive" data-testid="admin-scan-error">
                Son hata: {scanner.last_error}
              </p>
            ) : null}
            <div className="space-y-1" data-testid="admin-scan-results">
              <p className="text-xs font-semibold text-muted-foreground">Son güncellenen sinyaller</p>
              {(stats?.recent_signals ?? []).map((row: any) => (
                <div key={row.symbol} className="flex items-center justify-between rounded-sm border border-border/60 p-2 text-xs">
                  <span className="font-mono">{row.symbol} · {row.market}</span>
                  <span className="font-mono">
                    {row.action} · {row.bullish_score} · {formatDate(row.updated_at)}
                  </span>
                </div>
              ))}
              {!(stats?.recent_signals ?? []).length ? (
                <p className="text-xs text-muted-foreground">Henüz tarama sonucu yok.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/50" data-testid="admin-accuracy-card">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Formasyon İsabet Oranı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl font-black text-primary" data-testid="admin-accuracy-value">
                {accuracy?.accuracy_pct ?? 0}%
              </span>
              <span className="text-xs text-muted-foreground">
                {accuracy?.hit ?? 0} isabet / {accuracy?.evaluated ?? 0} değerlendirilen kırılım
              </span>
            </div>
            <div className="space-y-1">
              {(accuracy?.per_pattern ?? []).map((row: any) => (
                <div key={row.name} className="flex items-center justify-between rounded-sm border border-border/60 p-2 text-xs">
                  <span>{row.name}</span>
                  <span className="font-mono">
                    {row.accuracy_pct}% ({row.hit}/{row.total})
                  </span>
                </div>
              ))}
              {!(accuracy?.per_pattern ?? []).length ? (
                <p className="text-xs text-muted-foreground">Henüz değerlendirilebilir onaylı formasyon yok.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/50" data-testid="admin-errors-card">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Son Sistem Hataları</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto p-4 pt-0 text-xs">
            {(stats?.recent_errors ?? []).map((row: any) => (
              <div key={row.id} className="rounded-sm border border-destructive/40 bg-destructive/10 p-2">
                <p className="font-mono text-[11px] text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("tr-TR")} · {row.source || "bilinmiyor"}
                </p>
                <p className="text-foreground">{row.message}</p>
              </div>
            ))}
            {!(stats?.recent_errors ?? []).length ? <p className="text-muted-foreground">Kayıtlı hata yok.</p> : null}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-card/50" data-testid="admin-manage-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Admin Ekle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0">
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleCreateAdmin} data-testid="admin-create-form">
            <div className="space-y-1">
              <Label htmlFor="new-admin-username">Kullanıcı Adı</Label>
              <Input
                id="new-admin-username"
                value={newAdmin.username}
                onChange={(e) => setNewAdmin((prev) => ({ ...prev, username: e.target.value }))}
                data-testid="admin-create-username-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-admin-password">Şifre (min 8)</Label>
              <Input
                id="new-admin-password"
                type="password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin((prev) => ({ ...prev, password: e.target.value }))}
                data-testid="admin-create-password-input"
              />
            </div>
            <Button type="submit" data-testid="admin-create-submit">Ekle</Button>
            {adminMessage ? <p className="text-xs text-muted-foreground">{adminMessage}</p> : null}
          </form>

          <div className="flex flex-wrap gap-2" data-testid="admin-list">
            {(data?.admins ?? []).map((admin: any) => (
              <Badge key={admin.id} variant="outline" className="rounded-sm">
                {admin.username} · {new Date(admin.created_at).toLocaleDateString("tr-TR")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
