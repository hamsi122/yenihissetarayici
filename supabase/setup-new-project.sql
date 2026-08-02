-- Alpha Garden — yeni Supabase projesi kurulum scripti
-- Supabase Dashboard -> SQL Editor -> New query -> bu dosyanın tamamını yapıştır -> Run

CREATE TABLE IF NOT EXISTS public.signals (
  symbol text PRIMARY KEY,
  market text NOT NULL,
  action text NOT NULL,
  bullish_score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  doc jsonb NOT NULL
);
GRANT SELECT ON public.signals TO anon;
GRANT SELECT ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signals are public to read" ON public.signals;
CREATE POLICY "Signals are public to read" ON public.signals FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS signals_score_idx ON public.signals (bullish_score DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.scanner_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  running boolean NOT NULL DEFAULT false,
  last_run timestamptz,
  last_error text,
  last_duration_seconds double precision,
  last_scanned_count integer NOT NULL DEFAULT 0,
  cursor_index integer NOT NULL DEFAULT 0,
  started_at timestamptz
);
GRANT ALL ON public.scanner_state TO service_role;
ALTER TABLE public.scanner_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.scanner_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No client access to admin users" ON public.admin_users;
CREATE POLICY "No client access to admin users"
  ON public.admin_users FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.page_views (
  id bigserial PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.error_logs (
  id bigserial PRIMARY KEY,
  message text NOT NULL,
  source text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs (created_at DESC);

-- Admin kullanıcısı (kullanıcı adı: ozgur — mevcut şifrenle aynı)
INSERT INTO public.admin_users (username, password_hash, password_salt, created_by)
VALUES ('ozgur', 'f3bf838a9ed1fa31eab282914f2b2f1c1e3e700f59f2f601feb7136e881d6fd0', 'd46841330876bd131dca540c2713165a', 'system')
ON CONFLICT (username) DO NOTHING;

-- Günlük otomatik tarama (03:00 UTC). Vercel domainin hazır olduktan SONRA çalıştır.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- SELECT cron.unschedule('daily-full-scan');
-- SELECT cron.schedule(
--   'daily-full-scan',
--   '0 3 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://SENIN-VERCEL-DOMAININ/api/public/hooks/scan',
--     headers := '{"Content-Type":"application/json","apikey":"sb_publishable_fLc4EvCgqZ18YvXoC0U_pQ_Lb_0sVcG"}'::jsonb,
--     body := '{"full": true}'::jsonb
--   );
--   $$
-- );
