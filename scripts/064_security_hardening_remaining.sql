BEGIN;

-- Better Auth's distributed rate limiter uses this exact model shape.
CREATE TABLE IF NOT EXISTS public."rateLimit" (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);

ALTER TABLE public."rateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."rateLimit" FROM PUBLIC;
REVOKE ALL ON TABLE public."rateLimit" FROM anon;
REVOKE ALL ON TABLE public."rateLimit" FROM authenticated;

-- The clipboard RPC is SECURITY DEFINER. PostgreSQL grants function execution
-- to PUBLIC by default, so every browser role must be revoked explicitly.
REVOKE ALL ON FUNCTION public.upsert_clipboard(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_clipboard(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_clipboard(TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_clipboard(TEXT, TEXT, TEXT) TO service_role;

COMMIT;
