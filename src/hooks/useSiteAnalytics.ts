import { useEffect } from "react";
import { trackError, trackPageView } from "@/lib/admin.functions";

const SESSION_KEY = "ht_session_id";

function getSessionId() {
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Ziyaret ve istemci hatalarını yönetim paneli istatistikleri için kaydeder. */
export function useSiteAnalytics() {
  useEffect(() => {
    trackPageView({
      data: {
        path: window.location.pathname,
        referrer: document.referrer || null,
        sessionId: getSessionId(),
      },
    }).catch(() => {});

    const onError = (event: ErrorEvent) => {
      trackError({
        data: {
          message: String(event.message || "Bilinmeyen hata"),
          source: "browser",
          details: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        },
      }).catch(() => {});
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      trackError({
        data: {
          message: String(reason?.message ?? reason ?? "Yakalanmamış promise hatası"),
          source: "browser-unhandledrejection",
          details: null,
        },
      }).catch(() => {});
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}
