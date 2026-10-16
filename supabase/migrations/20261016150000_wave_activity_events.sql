-- WAVE activity log (#268): one append-only row per buyer or staff action,
-- kept in WAVE's own database rather than product analytics. Additive only.
-- No foreign keys, so removing a buyer or opportunity never rewrites history.
BEGIN;

CREATE TABLE public.wave_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action ~ '^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$'),
  actor_user_id text,
  actor_role text NOT NULL CHECK (actor_role IN ('staff', 'repreneur', 'unassigned', 'system')),
  repreneur_id uuid,
  opportunity_id uuid,
  match_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX wave_activity_events_occurred_at_idx ON public.wave_activity_events (occurred_at DESC);
CREATE INDEX wave_activity_events_action_idx ON public.wave_activity_events (action, occurred_at DESC);
CREATE INDEX wave_activity_events_actor_idx ON public.wave_activity_events (actor_user_id, occurred_at DESC);
CREATE INDEX wave_activity_events_repreneur_idx ON public.wave_activity_events (repreneur_id, occurred_at DESC)
  WHERE repreneur_id IS NOT NULL;
CREATE INDEX wave_activity_events_opportunity_idx ON public.wave_activity_events (opportunity_id, occurred_at DESC)
  WHERE opportunity_id IS NOT NULL;

COMMENT ON TABLE public.wave_activity_events IS
  'Append-only log of buyer and staff actions in WAVE (#268): sign-ins, deal opens, memo and NDA template downloads, interest and declines with reasons, profile changes and staff Claude connection use.';
COMMENT ON COLUMN public.wave_activity_events.occurred_at IS 'When the action happened.';
COMMENT ON COLUMN public.wave_activity_events.action IS
  'Stable action code, e.g. auth.signed_in, portal.deal_opened, portal.memo_opened, portal.nda_template_downloaded, portal.interest_expressed, portal.interest_declined, portal.interest_withdrawn, profile.target_thesis_changed, profile.contribution_certified, profile.language_changed, mcp.connected, mcp.tool_called.';
COMMENT ON COLUMN public.wave_activity_events.actor_user_id IS 'Better Auth user id of the person who acted; join app_user_roles.user_id for their email.';
COMMENT ON COLUMN public.wave_activity_events.actor_role IS 'Role of the person who acted at that moment: staff, repreneur, unassigned or system.';
COMMENT ON COLUMN public.wave_activity_events.repreneur_id IS 'The buyer concerned (repreneurs.id), also when staff acted on their behalf.';
COMMENT ON COLUMN public.wave_activity_events.opportunity_id IS 'The opportunity concerned (opportunities.id).';
COMMENT ON COLUMN public.wave_activity_events.match_id IS 'The buyer-opportunity match concerned (opportunity_matches.id).';
COMMENT ON COLUMN public.wave_activity_events.details IS
  'Action-specific facts: decline reason_categories and reason_text, withdrawal reason, interest path, changed criteria fields with from/to values, language, document_id, Claude tool, table and outcome.';

ALTER TABLE public.wave_activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wave_activity_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.wave_activity_events TO service_role;

COMMIT;
