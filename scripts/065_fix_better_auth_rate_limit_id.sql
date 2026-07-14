BEGIN;

-- Better Auth's database adapter always writes and reads an internal `id`.
-- Keep `key` as the conflict target used by the platform's perimeter limiter,
-- while supplying the adapter-compatible identifier for both write paths.
ALTER TABLE public."rateLimit"
  ADD COLUMN IF NOT EXISTS id TEXT;

UPDATE public."rateLimit"
SET id = gen_random_uuid()::TEXT
WHERE id IS NULL;

ALTER TABLE public."rateLimit"
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT,
  ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_id_uidx
  ON public."rateLimit" (id);

COMMIT;
