-- 1) Remove public read exposure of internal scanner operational data
DROP POLICY IF EXISTS "Scanner state is public to read" ON public.scanner_state;

REVOKE ALL ON public.scanner_state FROM anon;
REVOKE ALL ON public.scanner_state FROM authenticated;
GRANT ALL ON public.scanner_state TO service_role;

-- scanner_state is read/written only by trusted server code (service role), which bypasses RLS.
ALTER TABLE public.scanner_state ENABLE ROW LEVEL SECURITY;

-- 2) Harden admin credential table: deny-all for public/authenticated, service role only
REVOKE ALL ON public.admin_users FROM anon;
REVOKE ALL ON public.admin_users FROM authenticated;
GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to admin users" ON public.admin_users;
CREATE POLICY "No client access to admin users"
  ON public.admin_users
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
