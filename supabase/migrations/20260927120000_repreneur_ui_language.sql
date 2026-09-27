-- #133 / conceptual migration 128. Optional, account-owned UI preference.
-- Additive only; no historical account-preference backfill.
CREATE TABLE public.repreneur_ui_preferences (
  user_id TEXT PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('fr', 'en'))
);

ALTER TABLE public.repreneur_ui_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repreneur_ui_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.repreneur_ui_preferences FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.repreneur_ui_preferences TO service_role;
