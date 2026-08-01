CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.page_views (
  id bigserial PRIMARY KEY,
  path text NOT NULL,
  referrer text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.error_logs (
  id bigserial PRIMARY KEY,
  message text NOT NULL,
  source text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX error_logs_created_at_idx ON public.error_logs (created_at DESC);

INSERT INTO public.admin_users (username, password_hash, password_salt, created_by)
VALUES ('ozgur', 'f3bf838a9ed1fa31eab282914f2b2f1c1e3e700f59f2f601feb7136e881d6fd0', 'd46841330876bd131dca540c2713165a', 'system');