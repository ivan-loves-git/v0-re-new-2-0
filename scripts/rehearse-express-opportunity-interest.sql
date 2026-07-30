-- Disposable runtime rehearsal for migration 084.
-- Run with psql against an empty local database. The fixture contains no
-- project environment, production URL, real person or real opportunity.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

CREATE TYPE public.opportunity_status AS ENUM (
  'draft',
  'active',
  'paused',
  'archived',
  'closed'
);
CREATE TYPE public.opportunity_visibility AS ENUM (
  'staff_only',
  'anonymized',
  'repreneur_visible'
);
CREATE TYPE public.opportunity_match_status AS ENUM (
  'draft',
  'shortlisted',
  'proposed',
  'interested',
  'declined',
  'active_pursuit',
  'dropped'
);
CREATE TYPE public.opportunity_pursuit_stage AS ENUM (
  'interest',
  'info_memo_received',
  'intermediary_meeting',
  'seller_meeting',
  'loi',
  'closed',
  'dropped'
);

CREATE TABLE public.repreneurs (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL
);

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  status public.opportunity_status NOT NULL,
  repreneur_exposure public.opportunity_visibility NOT NULL
);

CREATE TABLE public.opportunity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id),
  status public.opportunity_match_status NOT NULL DEFAULT 'draft',
  decline_reason_categories TEXT[] NOT NULL DEFAULT '{}',
  decline_reason_text TEXT,
  pursuit_stage public.opportunity_pursuit_stage,
  pursuit_stage_notes TEXT,
  pursuit_stage_updated_by TEXT,
  pursuit_stage_updated_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interest_expressed_at TIMESTAMPTZ,
  interest_notification_sent_at TIMESTAMPTZ,
  UNIQUE (opportunity_id, repreneur_id)
);

CREATE UNIQUE INDEX idx_opportunity_matches_one_active_pursuit
  ON public.opportunity_matches(opportunity_id)
  WHERE status = 'active_pursuit';

INSERT INTO public.repreneurs (id, email)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'one@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'two@example.test');

INSERT INTO public.opportunities (id, reference, status, repreneur_exposure)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'W067-UNASSIGNED', 'active', 'anonymized'),
  ('20000000-0000-4000-8000-000000000002', 'W067-LOCKED', 'active', 'repreneur_visible'),
  ('20000000-0000-4000-8000-000000000003', 'W067-STAFF', 'active', 'staff_only'),
  ('20000000-0000-4000-8000-000000000004', 'W067-INACTIVE', 'paused', 'anonymized'),
  ('20000000-0000-4000-8000-000000000005', 'W067-SELF-PURSUIT', 'active', 'anonymized'),
  ('20000000-0000-4000-8000-000000000006', 'W067-HISTORY', 'active', 'anonymized'),
  ('20000000-0000-4000-8000-000000000007', 'W067-RECONSIDER', 'active', 'anonymized');

INSERT INTO public.opportunity_matches (
  opportunity_id,
  repreneur_id,
  status,
  decline_reason_categories,
  decline_reason_text,
  pursuit_stage,
  pursuit_stage_notes,
  pursuit_stage_updated_by,
  pursuit_stage_updated_at,
  reviewed_by,
  reviewed_at,
  created_by
)
VALUES
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'active_pursuit',
    '{}',
    NULL,
    'interest',
    'existing pursuit remains intact',
    'staff-fixture',
    '2026-07-30 08:00:00+00',
    'staff-fixture',
    '2026-07-30 08:00:00+00',
    'staff-fixture'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'active_pursuit',
    '{}',
    NULL,
    'interest',
    NULL,
    'staff-fixture',
    '2026-07-30 08:00:00+00',
    'staff-fixture',
    '2026-07-30 08:00:00+00',
    'staff-fixture'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    'interested',
    '{}',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'legacy-fixture'
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    'declined',
    ARRAY['sector'],
    'not for me',
    'dropped',
    'stale',
    'staff-fixture',
    '2026-07-30 08:00:00+00',
    'staff-fixture',
    '2026-07-30 08:00:00+00',
    'staff-fixture'
  );

\ir 084_express_opportunity_interest.sql
\ir 084_express_opportunity_interest.sql

CREATE OR REPLACE FUNCTION public.w067_assert_raises(
  p_statement TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      IF POSITION(p_expected_message IN SQLERRM) = 0 THEN
        RAISE EXCEPTION
          'Expected error containing %, received %',
          p_expected_message,
          SQLERRM;
      END IF;
      RETURN;
  END;

  RAISE EXCEPTION 'Expected statement to fail with %', p_expected_message;
END;
$$;

DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.express_opportunity_interest(uuid,uuid,text,timestamptz)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.express_opportunity_interest(uuid,uuid,text,timestamptz)',
    'EXECUTE'
  ) OR has_function_privilege(
    'public',
    'public.express_opportunity_interest(uuid,uuid,text,timestamptz)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Non-service roles can execute express_opportunity_interest';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.express_opportunity_interest(uuid,uuid,text,timestamptz)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role cannot execute express_opportunity_interest';
  END IF;
END;
$$;

SET ROLE service_role;

SELECT *
FROM public.express_opportunity_interest(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'repreneur-user-1',
  '2026-07-30 09:00:00+00'
);

-- A retry must reuse the pair and preserve the original signal timestamp.
SELECT *
FROM public.express_opportunity_interest(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'repreneur-user-1',
  '2026-07-30 10:00:00+00'
);

SELECT *
FROM public.express_opportunity_interest(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'repreneur-user-1',
  '2026-07-30 11:00:00+00'
);

SELECT *
FROM public.express_opportunity_interest(
  '20000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000001',
  'repreneur-user-1',
  '2026-07-30 12:00:00+00'
);

RESET ROLE;

SELECT public.w067_assert_raises(
  $$SELECT * FROM public.express_opportunity_interest(
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'repreneur-user-1',
    NOW()
  )$$,
  'interest_not_available'
);
SELECT public.w067_assert_raises(
  $$SELECT * FROM public.express_opportunity_interest(
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'repreneur-user-1',
    NOW()
  )$$,
  'interest_not_available'
);
SELECT public.w067_assert_raises(
  $$SELECT * FROM public.express_opportunity_interest(
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'repreneur-user-1',
    NOW()
  )$$,
  'interest_not_available'
);
SELECT public.w067_assert_raises(
  $$SELECT * FROM public.express_opportunity_interest(
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    'repreneur-user-1',
    NOW()
  )$$,
  'interest_not_available'
);

DO $$
DECLARE
  v_unassigned public.opportunity_matches%ROWTYPE;
  v_locked_interest public.opportunity_matches%ROWTYPE;
  v_existing_pursuit public.opportunity_matches%ROWTYPE;
  v_reconsidered public.opportunity_matches%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_unassigned
  FROM public.opportunity_matches
  WHERE opportunity_id = '20000000-0000-4000-8000-000000000001'
    AND repreneur_id = '10000000-0000-4000-8000-000000000001';

  IF v_unassigned.status <> 'interested'
    OR v_unassigned.interest_expressed_at <> '2026-07-30 09:00:00+00'
    OR v_unassigned.created_by <> 'repreneur-user-1' THEN
    RAISE EXCEPTION 'Unassigned interest or retry evidence is incorrect';
  END IF;

  SELECT * INTO STRICT v_locked_interest
  FROM public.opportunity_matches
  WHERE opportunity_id = '20000000-0000-4000-8000-000000000002'
    AND repreneur_id = '10000000-0000-4000-8000-000000000001';

  SELECT * INTO STRICT v_existing_pursuit
  FROM public.opportunity_matches
  WHERE opportunity_id = '20000000-0000-4000-8000-000000000002'
    AND repreneur_id = '10000000-0000-4000-8000-000000000002';

  IF v_locked_interest.status <> 'interested'
    OR v_existing_pursuit.status <> 'active_pursuit'
    OR v_existing_pursuit.pursuit_stage_notes <> 'existing pursuit remains intact' THEN
    RAISE EXCEPTION 'Locked interest changed the existing active pursuit';
  END IF;

  SELECT * INTO STRICT v_reconsidered
  FROM public.opportunity_matches
  WHERE opportunity_id = '20000000-0000-4000-8000-000000000007'
    AND repreneur_id = '10000000-0000-4000-8000-000000000001';

  IF v_reconsidered.status <> 'interested'
    OR v_reconsidered.decline_reason_categories <> '{}'
    OR v_reconsidered.decline_reason_text IS NOT NULL
    OR v_reconsidered.pursuit_stage IS NOT NULL
    OR v_reconsidered.pursuit_stage_notes IS NOT NULL
    OR v_reconsidered.reviewed_by IS NOT NULL
    OR v_reconsidered.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reconsidered interest retained stale decision evidence';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.opportunity_matches
    WHERE status = 'active_pursuit'
  ) <> 2 THEN
    RAISE EXCEPTION 'Interest signaling created or removed an active pursuit';
  END IF;
END;
$$;

SELECT 'W-067 disposable rehearsal passed' AS result;
