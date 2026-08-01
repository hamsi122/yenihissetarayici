import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Expand, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

const formatCompact = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
};

const healthStatus = (ok, warnText, okText) =>
  ok
    ? { status: okText, className: "border-primary/40 bg-primary/15 text-primary" }
    : { status: warnText, className: "border-destructive/40 bg-destructive/15 text-destructive" };

const patternClass = (direction) =>
  direction === "bullish"
    ? "border-primary/40 bg-primary/15 text-primary"
    : "border-destructive/40 bg-destructive/15 text-destructive";

const resolvePatternImageUrl = (rawUrl) => {
  if (!rawUrl) {
    return null;
  }
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  const normalized = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return normalized;
};

export const SignalDetailSheet = ({ open, signal, explaining, onOpenChange, onExplain, onReanalyze, onRegenerateImage }) => {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const imageUrl = resolvePatternImageUrl(signal?.pattern_image_url);
  const isStrongSignal = signal?.action === "GÜÇLÜ AL" || signal?.action === "GÜÇLÜ SAT";
  const preparingImage = Boolean(explaining && isStrongSignal);

  useEffect(() => {
    if (!preparingImage) {
      setImageProgress((previous) => (previous > 0 ? 100 : 0));
      const reset = setTimeout(() => setImageProgress(0), 900);
      return () => clearTimeout(reset);
    }
    setImageProgress(5);
    const timer = setInterval(() => {
      setImageProgress((previous) => (previous >= 95 ? 95 : previous + Math.max(1, Math.round((95 - previous) / 12))));
    }, 350);
    return () => clearInterval(timer);
  }, [preparingImage, signal?.symbol]);

  const ratioText = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }
    return `${(Number(value) * 100).toFixed(2)}%`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-border/80 bg-background/95 p-0 sm:max-w-2xl"
        data-testid="signal-detail-sheet"
      >
        {!signal ? (
          <div className="p-6 text-sm text-muted-foreground" data-testid="signal-detail-empty-state">
            Detay için soldan bir hisse seçin.
          </div>
        ) : (
          <div className="animate-slide-in-right space-y-5 p-6" data-testid="signal-detail-content">
            <SheetHeader className="space-y-2 text-left" data-testid="signal-detail-header">
              <SheetTitle className="font-heading text-2xl font-black" data-testid="signal-detail-title">
                {signal.symbol} · AI Raporu
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground" data-testid="signal-detail-subtitle">
                Karar: {signal.action} · Bullish Score: {signal.bullish_score}
              </SheetDescription>
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="rounded-sm border-border"
                  onClick={() => onReanalyze(signal.symbol)}
                  disabled={explaining}
                  data-testid="signal-detail-reanalyze-button"
                >
                  {explaining ? "Yeniden analiz ediliyor..." : "Yeniden Analiz Et"}
                </Button>
              </div>
            </SheetHeader>

            <section className="space-y-2" data-testid="signal-detail-pattern-image-section">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="signal-detail-pattern-image-title">
                Formasyon Onay Görseli
              </h3>
              {imageUrl ? (
                <>
                  <div className="relative overflow-hidden rounded-sm border border-border/70 bg-card/50" data-testid="signal-detail-pattern-image-wrapper">
                    <img
                      src={imageUrl}
                      alt={`${signal.symbol} formasyon görseli`}
                      className="h-auto w-full object-contain"
                      data-testid="signal-detail-pattern-image"
                    />
                    <Button
                      variant="secondary"
                      className="absolute right-2 top-2 h-8 rounded-sm px-2"
                      onClick={() => setImagePreviewOpen(true)}
                      data-testid="signal-detail-image-expand-button"
                    >
                      <Expand className="h-4 w-4" />
                      Görseli Büyüt
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-sm border-border"
                    onClick={() => onRegenerateImage(signal.symbol)}
                    disabled={explaining}
                    data-testid="signal-detail-regenerate-image-button"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Görseli Tekrar Oluştur
                  </Button>
                  {preparingImage ? (
                    <div className="space-y-1" data-testid="signal-detail-image-progress-existing">
                      <Progress value={imageProgress} className="h-2" />
                      <p className="text-right font-mono text-[11px] text-muted-foreground">
                        Formasyon onay görseli hazırlanıyor · %{imageProgress}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-2 rounded-sm border border-dashed border-border/70 bg-card/40 p-3 text-xs text-muted-foreground" data-testid="signal-detail-pattern-image-empty-state">
                  <p>
                    {isStrongSignal
                      ? "Güçlü sinyal için formasyon onay görseli hazırlanıyor."
                      : "Bu sembolde statik formasyon görseli yalnızca GÜÇLÜ AL/GÜÇLÜ SAT sinyallerinde üretilir."}
                  </p>
                  {preparingImage ? (
                    <div className="space-y-1" data-testid="signal-detail-image-progress">
                      <Progress value={imageProgress} className="h-2" data-testid="signal-detail-image-progress-bar" />
                      <p className="text-right font-mono text-[11px] text-foreground" data-testid="signal-detail-image-progress-value">
                        %{imageProgress}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-2" data-testid="signal-detail-pattern-badges">
              {(signal.patterns || []).map((pattern, index) => (
                <Badge key={`${pattern.name}-${index}`} className={`rounded-sm border ${patternClass(pattern.direction)}`} data-testid={`signal-detail-pattern-${index}-badge`}>
                  {pattern.name} · {pattern.confirmed ? "Onay" : "Takip"}
                </Badge>
              ))}
            </div>

            <Separator />

            <Tabs defaultValue="summary" className="w-full" data-testid="signal-detail-tabs">
              <TabsList className="rounded-sm" data-testid="signal-detail-tabs-list">
                <TabsTrigger value="summary" data-testid="signal-detail-summary-tab-trigger">Özet</TabsTrigger>
                <TabsTrigger value="detail" data-testid="signal-detail-technical-fundamental-tab-trigger">Detaylı Bak</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4" data-testid="signal-detail-summary-tab-content">
                <section className="space-y-2" data-testid="signal-detail-risk-section">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="signal-detail-risk-title">Aksiyon ve Risk</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm" data-testid="signal-detail-risk-grid">
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-entry-box">
                      <p className="text-muted-foreground">Giriş</p>
                      <p className="font-mono" data-testid="signal-detail-entry-value">{signal.risk?.entry_price ?? "-"}</p>
                    </div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-stop-loss-box">
                      <p className="text-muted-foreground">Stop-Loss</p>
                      <p className="font-mono text-destructive" data-testid="signal-detail-stop-loss-value">{signal.risk?.stop_loss ?? "-"}</p>
                    </div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-take-profit-box">
                      <p className="text-muted-foreground">Take-Profit</p>
                      <p className="font-mono text-primary" data-testid="signal-detail-take-profit-value">{signal.risk?.take_profit ?? "-"}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-2" data-testid="signal-detail-volume-section">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="signal-detail-volume-title">Hacim Durumu</h3>
                  <div className="rounded-sm border border-border/70 bg-card/60 p-3 text-sm" data-testid="signal-detail-volume-content">
                    <p className="text-foreground" data-testid="signal-detail-volume-human-text">{signal.volume_analysis?.human_text || "Hacim verisi bulunamadı."}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground" data-testid="signal-detail-volume-breakout-note">
                      {signal.volume_analysis?.breakout_note || "-"}
                    </p>
                  </div>
                </section>

                <div className="space-y-2" data-testid="signal-detail-ai-summary-section">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="signal-detail-ai-summary-title">Yapay Zeka Raporu</h3>
                    <Button
                      className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => onExplain(signal.symbol)}
                      disabled={explaining}
                      data-testid="signal-detail-generate-ai-button"
                    >
                      {explaining ? "Üretiliyor..." : "Raporu Üret / Güncelle"}
                    </Button>
                  </div>

                  <div className="rounded-sm border border-border/70 bg-card/60 p-3" data-testid="signal-detail-ai-summary-content">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground" data-testid="signal-detail-ai-summary-text">
                      {signal.ai_summary || "Henüz AI raporu üretilmedi. Butona basarak oluşturabilirsiniz."}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="detail" className="space-y-4" data-testid="signal-detail-technical-fundamental-tab-content">
                <section className="space-y-2" data-testid="signal-detail-technical-section">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="signal-detail-technical-title">Teknik Durum</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm" data-testid="signal-detail-technical-grid">
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-rsi-box"><p className="text-muted-foreground">RSI(14)</p><p className="font-mono" data-testid="signal-detail-rsi-value">{signal.indicators?.rsi14 ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-macd-box"><p className="text-muted-foreground">MACD</p><p className="font-mono" data-testid="signal-detail-macd-value">{signal.indicators?.macd ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-bb-upper-box"><p className="text-muted-foreground">Bollinger Üst</p><p className="font-mono" data-testid="signal-detail-bb-upper-value">{signal.indicators?.bb_upper ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-bb-lower-box"><p className="text-muted-foreground">Bollinger Alt</p><p className="font-mono" data-testid="signal-detail-bb-lower-value">{signal.indicators?.bb_lower ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-stochastic-k-box"><p className="text-muted-foreground">Stokastik %K</p><p className="font-mono" data-testid="signal-detail-stochastic-k-value">{signal.indicators?.stochastic_k ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-stochastic-d-box"><p className="text-muted-foreground">Stokastik %D</p><p className="font-mono" data-testid="signal-detail-stochastic-d-value">{signal.indicators?.stochastic_d ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-adx-box"><p className="text-muted-foreground">ADX(14)</p><p className="font-mono" data-testid="signal-detail-adx-value">{signal.indicators?.adx14 ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-ichimoku-tenkan-box"><p className="text-muted-foreground">Ichimoku Tenkan</p><p className="font-mono" data-testid="signal-detail-ichimoku-tenkan-value">{signal.indicators?.ichimoku_tenkan ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-ichimoku-kijun-box"><p className="text-muted-foreground">Ichimoku Kijun</p><p className="font-mono" data-testid="signal-detail-ichimoku-kijun-value">{signal.indicators?.ichimoku_kijun ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-ichimoku-span-a-box"><p className="text-muted-foreground">Ichimoku Span A</p><p className="font-mono" data-testid="signal-detail-ichimoku-span-a-value">{signal.indicators?.ichimoku_span_a ?? "-"}</p></div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-ichimoku-span-b-box"><p className="text-muted-foreground">Ichimoku Span B</p><p className="font-mono" data-testid="signal-detail-ichimoku-span-b-value">{signal.indicators?.ichimoku_span_b ?? "-"}</p></div>
                  </div>
                </section>

                <section className="space-y-3" data-testid="signal-detail-fundamental-section">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="signal-detail-fundamental-title">Temel Analiz</h3>

                  <div className="rounded-sm border border-border/70 bg-card/60 p-3" data-testid="signal-detail-fundamental-score">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Temel Analiz Kalite Skoru</span>
                      <span className="font-mono font-bold text-foreground">{signal.fundamental?.score ?? 0}/100</span>
                    </div>
                    <Progress value={Number(signal.fundamental?.score ?? 0)} className="mt-2 h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Matris skoruna katkı ağırlığı: %30 · Hesaplanan puan: {signal.score_breakdown?.fundamental ?? 0}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm" data-testid="signal-detail-fundamental-highlights">
                    <div className="rounded-sm border border-border/70 p-2">
                      <p className="text-muted-foreground">Sektör</p>
                      <p className="font-semibold">{signal.fundamental?.sector ?? "-"}</p>
                    </div>
                    <div className="rounded-sm border border-border/70 p-2">
                      <p className="text-muted-foreground">Piyasa Değeri</p>
                      <p className="font-mono">{formatCompact(signal.fundamental?.market_cap)}</p>
                    </div>
                  </div>

                  <div className="space-y-1" data-testid="signal-detail-financial-health">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finansal Sağlık</h4>
                    {[
                      {
                        key: "liquidity",
                        label: "Likidite (Cari Oran)",
                        value: signal.fundamental?.current_ratio ?? "-",
                        ...healthStatus(Number(signal.fundamental?.current_ratio ?? 0) >= 1, "Zayıf", "Sağlıklı"),
                      },
                      {
                        key: "leverage",
                        label: "Borçluluk (Borç/Özsermaye)",
                        value: signal.fundamental?.debt_to_equity ?? "-",
                        ...healthStatus(
                          signal.fundamental?.debt_to_equity === null ||
                            signal.fundamental?.debt_to_equity === undefined ||
                            Number(signal.fundamental?.debt_to_equity) < 220,
                          "Yüksek Kaldıraç",
                          "Dengeli",
                        ),
                      },
                      {
                        key: "growth",
                        label: "Çeyreklik EPS Büyümesi",
                        value: ratioText(signal.fundamental?.eps_growth_qoq),
                        ...healthStatus(Number(signal.fundamental?.eps_growth_qoq ?? 0) > 0, "Daralma", "Büyüme"),
                      },
                      {
                        key: "margin",
                        label: "Net Kar Marjı",
                        value: ratioText(signal.fundamental?.net_profit_margin),
                        ...healthStatus(Number(signal.fundamental?.net_profit_margin ?? 0) > 0, "Negatif", "Pozitif"),
                      },
                      {
                        key: "valuation",
                        label: "F/K vs Sektör Ortalaması",
                        value: `${signal.fundamental?.pe ?? "-"} / ${signal.fundamental?.sector_pe_avg ?? "-"}`,
                        ...healthStatus(
                          signal.fundamental?.pe !== null &&
                            signal.fundamental?.pe !== undefined &&
                            Number(signal.fundamental?.pe) < Number(signal.fundamental?.sector_pe_avg ?? 0),
                          "Pahalı/Nötr",
                          "Iskontolu",
                        ),
                      },
                    ].map((row) => (
                      <div
                        key={row.key}
                        className="flex items-center justify-between gap-2 rounded-sm border border-border/60 p-2 text-sm"
                        data-testid={`signal-detail-health-${row.key}`}
                      >
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{row.value}</span>
                          <Badge
                            className={`rounded-sm border text-[10px] ${
                              String(row.value).includes("-") && String(row.value).trim() !== "-"
                                ? row.className
                                : String(row.value).trim() === "-"
                                  ? "border-border bg-muted/20 text-muted-foreground"
                                  : row.className
                            }`}
                          >
                            {String(row.value).trim() === "-" ? "Veri yok" : row.status}
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-sm border border-border/70" data-testid="signal-detail-fundamental-table-wrapper">
                    <table className="w-full text-sm" data-testid="signal-detail-fundamental-table">
                      <tbody>
                        <tr data-testid="signal-detail-pe-row"><td className="border-b border-border/60 p-2 text-muted-foreground">F/K (P/E)</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.pe ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-sector-pe-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Sektör Ortalama F/K</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.sector_pe_avg ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-pb-row"><td className="border-b border-border/60 p-2 text-muted-foreground">PD/DD (P/B)</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.pb ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-roe-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Özsermaye Karlılığı (ROE)</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.roe)}</td></tr>
                        <tr data-testid="signal-detail-debt-equity-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Borç / Özsermaye</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.debt_to_equity ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-net-margin-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Net Kar Marjı</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.net_profit_margin)}</td></tr>
                        <tr data-testid="signal-detail-eps-growth-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Çeyreklik EPS Büyümesi</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.eps_growth_qoq)}</td></tr>
                        <tr data-testid="signal-detail-dividend-yield-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Temettü Verimi</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.dividend_yield)}</td></tr>
                        <tr data-testid="signal-detail-market-cap-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Piyasa Değeri</td><td className="border-b border-border/60 p-2 font-mono">{formatCompact(signal.fundamental?.market_cap)}</td></tr>
                        <tr data-testid="signal-detail-current-ratio-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Cari Oran</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.current_ratio ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-quick-ratio-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Asit-Test (Quick Ratio)</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.quick_ratio ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-interest-coverage-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Faiz Karşılama Oranı</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.interest_coverage ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-gross-margin-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Brüt Kar Marjı</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.gross_margin)}</td></tr>
                        <tr data-testid="signal-detail-operating-margin-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Faaliyet Kar Marjı</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.operating_margin)}</td></tr>
                        <tr data-testid="signal-detail-fcf-margin-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Serbest Nakit Akışı Marjı</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.fcf_margin)}</td></tr>
                        <tr data-testid="signal-detail-revenue-growth-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Gelir Büyümesi (3Y)</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.revenue_growth_3y)}</td></tr>
                        <tr data-testid="signal-detail-peg-row"><td className="border-b border-border/60 p-2 text-muted-foreground">PEG Oranı</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.peg_ratio ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-earnings-yield-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Kazanç Getirisi</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.earnings_yield)}</td></tr>
                        <tr data-testid="signal-detail-payout-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Temettü Dağıtım Oranı</td><td className="border-b border-border/60 p-2 font-mono">{ratioText(signal.fundamental?.payout_ratio)}</td></tr>
                        <tr data-testid="signal-detail-eps-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Hisse Başı Kar (EPS)</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.eps ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-beta-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Beta</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.beta ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-altman-row"><td className="border-b border-border/60 p-2 text-muted-foreground">Altman Z-Skoru</td><td className="border-b border-border/60 p-2 font-mono">{signal.fundamental?.altman_z ?? "-"}</td></tr>
                        <tr data-testid="signal-detail-piotroski-row"><td className="p-2 text-muted-foreground">Piotroski F-Skoru</td><td className="p-2 font-mono">{signal.fundamental?.piotroski_f ?? "-"}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {(signal.fundamental?.notes || []).length ? (
                    <ul className="space-y-1 rounded-sm border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground" data-testid="signal-detail-fundamental-notes">
                      {(signal.fundamental?.notes || []).map((note, index) => (
                        <li key={index}>• {note}</li>
                      ))}
                    </ul>
                  ) : null}

                  {signal.fundamental?.hard_cap_trigger ? (
                    <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive" data-testid="signal-detail-hard-cap-note">
                      Temel risk tetiklendi: toplam skor güvenlik sınırına çekildi.
                    </p>
                  ) : null}
                </section>

                <section className="space-y-2" data-testid="signal-detail-matrix-section">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Matris Skoru Dağılımı</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-matrix-technical">
                      <p className="text-muted-foreground">Teknik (%40)</p>
                      <p className="font-mono">{signal.score_breakdown?.technical ?? "-"}</p>
                    </div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-matrix-volume">
                      <p className="text-muted-foreground">Hacim (%30)</p>
                      <p className="font-mono">{signal.score_breakdown?.volume ?? "-"}</p>
                    </div>
                    <div className="rounded-sm border border-border/70 p-2" data-testid="signal-detail-matrix-fundamental">
                      <p className="text-muted-foreground">Temel (%30)</p>
                      <p className="font-mono">{signal.score_breakdown?.fundamental ?? "-"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Toplam Matris Skoru: {signal.bullish_score}</p>
                                </section>
              </TabsContent>
            </Tabs>

            <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
              <DialogContent className="max-h-[95vh] max-w-6xl overflow-hidden rounded-sm border-border bg-background p-3" data-testid="signal-detail-image-preview-dialog">
                <DialogTitle data-testid="signal-detail-image-preview-title">{signal.symbol} · Formasyon Görseli</DialogTitle>
                <div className="max-h-[82vh] overflow-auto rounded-sm border border-border/70 bg-card/40 p-2" data-testid="signal-detail-image-preview-content">
                  <img src={imageUrl || ""} alt={`${signal.symbol} büyütülmüş formasyon`} className="h-auto w-full object-contain" data-testid="signal-detail-image-preview-full" />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
