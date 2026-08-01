CREATE TABLE public.signals (
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
CREATE POLICY "Signals are public to read" ON public.signals FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX signals_score_idx ON public.signals (bullish_score DESC, updated_at DESC);

CREATE TABLE public.scanner_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  running boolean NOT NULL DEFAULT false,
  last_run timestamptz,
  last_error text,
  last_duration_seconds double precision,
  last_scanned_count integer NOT NULL DEFAULT 0,
  cursor_index integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.scanner_state TO anon;
GRANT SELECT ON public.scanner_state TO authenticated;
GRANT ALL ON public.scanner_state TO service_role;
ALTER TABLE public.scanner_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scanner state is public to read" ON public.scanner_state FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.scanner_state (id) VALUES (1);