ALTER TABLE public.scanner_state ADD COLUMN IF NOT EXISTS started_at timestamptz;
UPDATE public.scanner_state SET running = false WHERE id = 1;