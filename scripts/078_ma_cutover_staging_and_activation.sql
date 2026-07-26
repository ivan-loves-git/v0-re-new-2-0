-- Migration: one-time M&A cutover staging and transactional activation
--
-- W-020 is a cutover rehearsal foundation, not a workbook importer. It stores
-- no raw workbook bytes and creates no browser-writable route. Temporary row
-- identifiers and cross-sheet mappings exist only in stage rows and are purged
-- with the stage issues after a successful, approved activation.
--
-- Run this only after migration 076 and its follow-up canonical identity
-- primitives have been applied and verified in the same release.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ma_cutover_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'staged',
      'review_required',
      'approved',
      'activating',
      'activated',
      'superseded'
    )),
  -- The retained manifest contains only a fingerprint/hash, aggregate counts
  -- and decisions. It deliberately has no file name, workbook bytes or source
  -- row identifiers.
  source_fingerprint TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  reconciliation_summary JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (JSONB_TYPEOF(reconciliation_summary) = 'object'),
  -- Structured, signed review decisions include the explicit optional-field
  -- allowlist used at activation. A free-form array cannot authorize writes.
  review_decisions JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (JSONB_TYPEOF(review_decisions) = 'object'),
  approval_digest TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  activation_actor TEXT,
  activation_started_at TIMESTAMPTZ,
  activated_by TEXT,
  activated_at TIMESTAMPTZ,
  result_summary JSONB
    CHECK (result_summary IS NULL OR JSONB_TYPEOF(result_summary) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(source_fingerprint), '') IS NOT NULL),
  CHECK (NULLIF(BTRIM(source_hash), '') IS NOT NULL),
  CHECK (
    status NOT IN ('approved', 'activating', 'activated')
    OR (
      NULLIF(BTRIM(approval_digest), '') IS NOT NULL
      AND NULLIF(BTRIM(approved_by), '') IS NOT NULL
      AND approved_at IS NOT NULL
    )
  ),
  CHECK (
    status <> 'activated'
    OR (
      NULLIF(BTRIM(activated_by), '') IS NOT NULL
      AND activated_at IS NOT NULL
      AND result_summary IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.ma_cutover_stage_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ma_cutover_runs(id) ON DELETE RESTRICT,
  entity_kind TEXT NOT NULL
    CHECK (entity_kind IN ('firm', 'office', 'contact', 'affiliation', 'opportunity')),
  -- Reuse is never inferred from a matching name, email or office. A reviewer
  -- must choose create or reuse and, for reuse, bind the reviewed canonical ID.
  resolution_action TEXT NOT NULL
    CHECK (resolution_action IN ('create', 'reuse')),
  reuse_canonical_id UUID,
  -- These are temporary, stage-only keys. They must never be copied to a live
  -- canonical entity or retained in the run manifest.
  temporary_entity_id TEXT NOT NULL,
  parent_temporary_entity_id TEXT,
  related_temporary_entity_ids JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (JSONB_TYPEOF(related_temporary_entity_ids) = 'array'),
  -- Row locator can contain sheet/row and cross-sheet source keys. It is never
  -- a raw workbook payload and it is deleted after successful activation.
  source_row_locator JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (JSONB_TYPEOF(source_row_locator) = 'object'),
  -- Canonically shaped values only; raw workbook bytes are intentionally not
  -- stored anywhere in this migration.
  normalized_payload JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (JSONB_TYPEOF(normalized_payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, entity_kind, temporary_entity_id),
  CHECK (NULLIF(BTRIM(temporary_entity_id), '') IS NOT NULL),
  CHECK (
    (resolution_action = 'create' AND reuse_canonical_id IS NULL)
    OR (resolution_action = 'reuse' AND reuse_canonical_id IS NOT NULL)
  ),
  CHECK (entity_kind <> 'opportunity' OR resolution_action = 'create')
);

CREATE TABLE IF NOT EXISTS public.ma_cutover_stage_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ma_cutover_runs(id) ON DELETE RESTRICT,
  stage_row_id UUID REFERENCES public.ma_cutover_stage_rows(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('blocker', 'warning')),
  code TEXT NOT NULL,
  field_name TEXT,
  message TEXT NOT NULL,
  resolution_note TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(code), '') IS NOT NULL),
  CHECK (NULLIF(BTRIM(message), '') IS NOT NULL),
  CHECK (
    (resolved_at IS NULL AND resolved_by IS NULL)
    OR (resolved_at IS NOT NULL AND NULLIF(BTRIM(resolved_by), '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ma_cutover_stage_rows_run_kind
  ON public.ma_cutover_stage_rows (run_id, entity_kind, temporary_entity_id);
CREATE INDEX IF NOT EXISTS idx_ma_cutover_stage_issues_unresolved
  ON public.ma_cutover_stage_issues (run_id, severity, id)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ma_cutover_stage_issues_run_id
  ON public.ma_cutover_stage_issues (run_id);
CREATE INDEX IF NOT EXISTS idx_ma_cutover_stage_issues_stage_row_id
  ON public.ma_cutover_stage_issues (stage_row_id);

CREATE OR REPLACE FUNCTION public.update_ma_cutover_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- The approval digest binds the reviewed staged content and decisions before
-- activation. It cannot be replaced, and no manifest field used to produce it
-- can change after the digest is present.
CREATE OR REPLACE FUNCTION public.guard_ma_cutover_run_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'activated' THEN
    RAISE EXCEPTION 'ma_cutover_activated_run_is_immutable';
  END IF;

  IF NEW.approval_digest IS NOT NULL
    AND NEW.status NOT IN ('approved', 'activating', 'activated') THEN
    RAISE EXCEPTION 'ma_cutover_approval_digest_requires_approved_status';
  END IF;

  IF OLD.approval_digest IS NOT NULL
    AND NEW.approval_digest IS DISTINCT FROM OLD.approval_digest THEN
    RAISE EXCEPTION 'ma_cutover_approval_digest_is_immutable';
  END IF;

  IF OLD.approval_digest IS NOT NULL
    AND (
      NEW.source_fingerprint IS DISTINCT FROM OLD.source_fingerprint
      OR NEW.source_hash IS DISTINCT FROM OLD.source_hash
      OR NEW.reconciliation_summary IS DISTINCT FROM OLD.reconciliation_summary
      OR NEW.review_decisions IS DISTINCT FROM OLD.review_decisions
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    ) THEN
    RAISE EXCEPTION 'ma_cutover_approved_manifest_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;

-- Staging remains editable only before approval. An activation changes status
-- to `activating` in the same transaction, then may delete the temporary rows
-- and issues but may not rewrite them.
CREATE OR REPLACE FUNCTION public.guard_ma_cutover_stage_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  run_status TEXT;
  target_run_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.run_id IS DISTINCT FROM OLD.run_id THEN
    RAISE EXCEPTION 'ma_cutover_stage_run_id_is_immutable';
  END IF;

  target_run_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.run_id ELSE NEW.run_id END;

  SELECT status
  INTO run_status
  FROM public.ma_cutover_runs
  WHERE id = target_run_id
  FOR KEY SHARE;

  IF run_status IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_not_found';
  END IF;

  IF run_status = 'approved' OR run_status = 'activated' THEN
    RAISE EXCEPTION 'ma_cutover_stage_is_immutable_after_approval';
  END IF;

  IF run_status = 'activating' AND TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'ma_cutover_stage_is_locked_during_activation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ma_cutover_runs_updated_at ON public.ma_cutover_runs;
CREATE TRIGGER update_ma_cutover_runs_updated_at
  BEFORE UPDATE ON public.ma_cutover_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ma_cutover_updated_at();

DROP TRIGGER IF EXISTS update_ma_cutover_stage_rows_updated_at ON public.ma_cutover_stage_rows;
CREATE TRIGGER update_ma_cutover_stage_rows_updated_at
  BEFORE UPDATE ON public.ma_cutover_stage_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ma_cutover_updated_at();

DROP TRIGGER IF EXISTS guard_ma_cutover_runs ON public.ma_cutover_runs;
CREATE TRIGGER guard_ma_cutover_runs
  BEFORE UPDATE ON public.ma_cutover_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_ma_cutover_run_immutability();

DROP TRIGGER IF EXISTS guard_ma_cutover_stage_rows ON public.ma_cutover_stage_rows;
CREATE TRIGGER guard_ma_cutover_stage_rows
  BEFORE INSERT OR UPDATE OR DELETE ON public.ma_cutover_stage_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_ma_cutover_stage_mutation();

DROP TRIGGER IF EXISTS guard_ma_cutover_stage_issues ON public.ma_cutover_stage_issues;
CREATE TRIGGER guard_ma_cutover_stage_issues
  BEFORE INSERT OR UPDATE OR DELETE ON public.ma_cutover_stage_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_ma_cutover_stage_mutation();

-- Service-role-only cutover activation. Lock ordering is run → stage rows
-- by entity/temporary ID → canonical entity advisory locks → W-061 primitive.
-- The function is explicitly SECURITY INVOKER: callers require their own
-- table/function grants, and browser roles receive neither.
CREATE OR REPLACE FUNCTION public.activate_ma_cutover_run(
  p_run_id UUID,
  p_approval_digest TEXT,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  run_row public.ma_cutover_runs%ROWTYPE;
  stage_row public.ma_cutover_stage_rows%ROWTYPE;
  contact_stage public.ma_cutover_stage_rows%ROWTYPE;
  firm_id UUID;
  office_id UUID;
  contact_id UUID;
  affiliation_id UUID;
  primary_affiliation_id UUID;
  affiliation_ids UUID[];
  created_opportunity public.opportunities%ROWTYPE;
  target_status public.opportunity_status;
  firm_name TEXT;
  normalized_name TEXT;
  normalized_contact_key TEXT;
  use_synthetic_default BOOLEAN;
  staged_revenue_meur TEXT;
  staged_ebitda_keur TEXT;
  staged_headcount TEXT;
  staged_date_added TEXT;
  optional_fields JSONB;
  approved_optional_fields JSONB;
  expected_firms INTEGER;
  expected_offices INTEGER;
  expected_contacts INTEGER;
  expected_affiliations INTEGER;
  expected_opportunities INTEGER;
  mapped_firms INTEGER;
  mapped_offices INTEGER;
  mapped_contacts INTEGER;
  mapped_affiliations INTEGER;
  created_opportunities INTEGER := 0;
  result JSONB;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_activation_actor_required';
  END IF;

  IF NULLIF(BTRIM(p_approval_digest), '') IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_activation_digest_required';
  END IF;

  SELECT *
  INTO run_row
  FROM public.ma_cutover_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF run_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_not_found';
  END IF;

  IF run_row.status <> 'approved' THEN
    RAISE EXCEPTION 'ma_cutover_run_requires_approved_status';
  END IF;

  IF NULLIF(BTRIM(run_row.approval_digest), '') IS NULL
    OR NULLIF(BTRIM(run_row.approved_by), '') IS NULL
    OR run_row.approved_at IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_requires_immutable_approval_digest';
  END IF;

  IF BTRIM(p_approval_digest) IS DISTINCT FROM BTRIM(run_row.approval_digest) THEN
    RAISE EXCEPTION 'ma_cutover_activation_digest_mismatch';
  END IF;

  approved_optional_fields := COALESCE(
    run_row.review_decisions -> 'approved_opportunity_fields',
    '[]'::JSONB
  );
  IF JSONB_TYPEOF(approved_optional_fields) <> 'array' THEN
    RAISE EXCEPTION 'ma_cutover_approved_optional_fields_must_be_array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_ARRAY_ELEMENTS(approved_optional_fields) AS approved(value)
    WHERE JSONB_TYPEOF(approved.value) <> 'string'
      OR approved.value #>> '{}' NOT IN (
        'sector',
        'activity',
        'location',
        'revenue_meur',
        'ebitda_keur',
        'headcount',
        'headcount_range',
        'date_added',
        'public_title',
        'teaser_summary',
        'internal_notes'
      )
  ) THEN
    RAISE EXCEPTION 'ma_cutover_approved_optional_fields_contains_unsupported_key';
  END IF;

  -- Lock staged rows deterministically before reading any mapping. This keeps
  -- the transaction short and prevents an approved set from changing under a
  -- second service process.
  PERFORM 1
  FROM public.ma_cutover_stage_rows row
  WHERE row.run_id = run_row.id
  ORDER BY row.entity_kind, row.temporary_entity_id, row.id
  FOR UPDATE;

  PERFORM 1
  FROM public.ma_cutover_stage_issues issue
  WHERE issue.run_id = run_row.id
  ORDER BY issue.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.ma_cutover_stage_issues issue
    WHERE issue.run_id = run_row.id
      AND issue.severity = 'blocker'
      AND issue.resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ma_cutover_run_has_unresolved_blockers';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE entity_kind = 'firm'),
    COUNT(*) FILTER (WHERE entity_kind = 'office'),
    COUNT(*) FILTER (WHERE entity_kind = 'contact'),
    COUNT(*) FILTER (WHERE entity_kind = 'affiliation'),
    COUNT(*) FILTER (WHERE entity_kind = 'opportunity')
  INTO
    expected_firms,
    expected_offices,
    expected_contacts,
    expected_affiliations,
    expected_opportunities
  FROM public.ma_cutover_stage_rows
  WHERE run_id = run_row.id;

  IF expected_firms = 0 OR expected_offices = 0 OR expected_opportunities = 0 THEN
    RAISE EXCEPTION 'ma_cutover_run_requires_dependency_closed_stage';
  END IF;

  UPDATE public.ma_cutover_runs
  SET
    status = 'activating',
    activation_actor = BTRIM(p_actor),
    activation_started_at = NOW()
  WHERE id = run_row.id;

  SET CONSTRAINTS ALL DEFERRED;

  CREATE TEMP TABLE ma_cutover_identity_map (
    entity_kind TEXT NOT NULL,
    temporary_entity_id TEXT NOT NULL,
    canonical_id UUID NOT NULL,
    PRIMARY KEY (entity_kind, temporary_entity_id)
  ) ON COMMIT DROP;

  -- `create_ma_firm_with_default_office` necessarily creates one named
  -- contact and affiliation. Cutover must first materialize the reviewed
  -- firm/office hierarchy and may legitimately contain a firm or office with
  -- no known person, so direct canonical inserts are limited to that parent
  -- layer. Contacts and opportunities use the audited W-061 primitives below.

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'firm'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    normalized_name := NULLIF(BTRIM(stage_row.normalized_payload ->> 'name'), '');
    IF normalized_name IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_firm_name_required';
    END IF;

    firm_id := NULL;
    IF stage_row.resolution_action = 'reuse' THEN
      SELECT firm.id
      INTO firm_id
      FROM public.ma_firms firm
      WHERE firm.id = stage_row.reuse_canonical_id
        AND firm.status <> 'archived'
        AND LOWER(BTRIM(firm.name)) = LOWER(normalized_name)
      FOR UPDATE;

      IF firm_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_firm_reuse_resolution_invalid';
      END IF;
    ELSE
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('ma_cutover_firm:' || LOWER(normalized_name))
      );

      IF EXISTS (
        SELECT 1
        FROM public.ma_firms firm
        WHERE LOWER(BTRIM(firm.name)) = LOWER(normalized_name)
        FOR KEY SHARE
      ) THEN
        RAISE EXCEPTION 'ma_cutover_stage_firm_collision_requires_explicit_reuse';
      END IF;

      INSERT INTO public.ma_firms (
        name,
        status,
        category,
        network_label,
        website_url,
        internal_notes,
        created_by,
        updated_by
      ) VALUES (
        normalized_name,
        'prospect',
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'category'), ''),
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'networkLabel'), ''),
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'websiteUrl'), ''),
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'internalNotes'), ''),
        BTRIM(p_actor),
        BTRIM(p_actor)
      )
      RETURNING id INTO firm_id;
    END IF;

    INSERT INTO pg_temp.ma_cutover_identity_map (
      entity_kind,
      temporary_entity_id,
      canonical_id
    ) VALUES ('firm', stage_row.temporary_entity_id, firm_id);
  END LOOP;

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'office'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    SELECT map.canonical_id
    INTO firm_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'firm'
      AND map.temporary_entity_id = stage_row.parent_temporary_entity_id;

    normalized_name := NULLIF(BTRIM(stage_row.normalized_payload ->> 'name'), '');
    IF firm_id IS NULL OR normalized_name IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_office_parent_or_name_required';
    END IF;

    IF NOT (stage_row.normalized_payload ? 'isSyntheticDefault')
      OR JSONB_TYPEOF(stage_row.normalized_payload -> 'isSyntheticDefault') <> 'boolean' THEN
      RAISE EXCEPTION 'ma_cutover_stage_office_synthetic_default_boolean_required';
    END IF;
    use_synthetic_default := (stage_row.normalized_payload ->> 'isSyntheticDefault')::BOOLEAN;

    SELECT firm.name
    INTO firm_name
    FROM public.ma_firms firm
    WHERE firm.id = firm_id
    FOR KEY SHARE;

    IF firm_name IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_office_parent_firm_not_found';
    END IF;

    IF use_synthetic_default
      AND LOWER(normalized_name) <> LOWER(BTRIM(firm_name)) THEN
      RAISE EXCEPTION 'ma_cutover_stage_synthetic_default_must_use_firm_name';
    END IF;

    IF use_synthetic_default
      AND EXISTS (
        SELECT 1
        FROM public.ma_offices office
        WHERE office.firm_id = firm_id
          AND office.status = 'active'
          AND NOT office.is_default
        FOR KEY SHARE
      ) THEN
      RAISE EXCEPTION 'ma_cutover_stage_synthetic_default_requires_unknown_office';
    END IF;

    -- Check the entire approved stage set, not only rows already visited in
    -- this loop. A real office with a later temporary ID must still prevent a
    -- synthetic fallback for the same canonical firm.
    IF use_synthetic_default
      AND EXISTS (
        SELECT 1
        FROM public.ma_cutover_stage_rows staged_office
        JOIN pg_temp.ma_cutover_identity_map staged_parent_firm
          ON staged_parent_firm.entity_kind = 'firm'
          AND staged_parent_firm.temporary_entity_id = staged_office.parent_temporary_entity_id
        WHERE staged_office.run_id = run_row.id
          AND staged_office.entity_kind = 'office'
          AND staged_office.id <> stage_row.id
          AND staged_parent_firm.canonical_id = firm_id
          AND COALESCE(
            CASE
              WHEN JSONB_TYPEOF(staged_office.normalized_payload -> 'isSyntheticDefault') = 'boolean'
                THEN (staged_office.normalized_payload ->> 'isSyntheticDefault')::BOOLEAN
              ELSE NULL
            END,
            FALSE
          ) = FALSE
      ) THEN
      RAISE EXCEPTION 'ma_cutover_stage_synthetic_default_requires_unknown_office';
    END IF;

    office_id := NULL;
    IF stage_row.resolution_action = 'reuse' THEN
      SELECT office.id
      INTO office_id
      FROM public.ma_offices office
      WHERE office.id = stage_row.reuse_canonical_id
        AND office.firm_id = firm_id
        AND office.status = 'active'
        AND office.is_default = use_synthetic_default
        AND LOWER(BTRIM(office.name)) = LOWER(normalized_name)
      FOR UPDATE;

      IF office_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_office_reuse_resolution_invalid';
      END IF;
    ELSE
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext(
          'ma_cutover_office:' || firm_id::TEXT || ':' || LOWER(normalized_name)
        )
      );

      IF EXISTS (
        SELECT 1
        FROM public.ma_offices office
        WHERE office.firm_id = firm_id
          AND LOWER(BTRIM(office.name)) = LOWER(normalized_name)
          AND office.status = 'active'
        FOR KEY SHARE
      ) THEN
        RAISE EXCEPTION 'ma_cutover_stage_office_collision_requires_explicit_reuse';
      END IF;

      INSERT INTO public.ma_offices (
        firm_id,
        name,
        status,
        is_default,
        city,
        internal_notes,
        created_by,
        updated_by
      ) VALUES (
        firm_id,
        normalized_name,
        'active',
        use_synthetic_default,
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'city'), ''),
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'internalNotes'), ''),
        BTRIM(p_actor),
        BTRIM(p_actor)
      )
      RETURNING id INTO office_id;
    END IF;

    INSERT INTO pg_temp.ma_cutover_identity_map (
      entity_kind,
      temporary_entity_id,
      canonical_id
    ) VALUES ('office', stage_row.temporary_entity_id, office_id);
  END LOOP;

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'affiliation'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    SELECT map.canonical_id
    INTO office_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'office'
      AND map.temporary_entity_id = stage_row.related_temporary_entity_ids ->> 0;

    IF office_id IS NULL
      OR JSONB_ARRAY_LENGTH(stage_row.related_temporary_entity_ids) <> 1 THEN
      RAISE EXCEPTION 'ma_cutover_stage_affiliation_mapping_required';
    END IF;

    SELECT *
    INTO contact_stage
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'contact'
      AND row.temporary_entity_id = stage_row.parent_temporary_entity_id
    FOR KEY SHARE;

    IF contact_stage.id IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_affiliation_contact_mapping_required';
    END IF;

    IF NULLIF(BTRIM(contact_stage.normalized_payload ->> 'firstName'), '') IS NULL
      AND NULLIF(BTRIM(contact_stage.normalized_payload ->> 'lastName'), '') IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_contact_identity_required';
    END IF;

    SELECT map.canonical_id
    INTO contact_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'contact'
      AND map.temporary_entity_id = contact_stage.temporary_entity_id;

    IF contact_id IS NULL AND contact_stage.resolution_action = 'reuse' THEN
      SELECT contact.id
      INTO contact_id
      FROM public.ma_contacts contact
      WHERE contact.id = contact_stage.reuse_canonical_id
        AND contact.status = 'active'
        AND (
          NULLIF(BTRIM(contact_stage.normalized_payload ->> 'firstName'), '') IS NULL
          OR LOWER(BTRIM(contact.first_name)) = LOWER(BTRIM(contact_stage.normalized_payload ->> 'firstName'))
        )
        AND (
          NULLIF(BTRIM(contact_stage.normalized_payload ->> 'lastName'), '') IS NULL
          OR LOWER(BTRIM(contact.last_name)) = LOWER(BTRIM(contact_stage.normalized_payload ->> 'lastName'))
        )
        AND (
          NULLIF(BTRIM(contact_stage.normalized_payload ->> 'email'), '') IS NULL
          OR LOWER(BTRIM(contact.email)) = LOWER(BTRIM(contact_stage.normalized_payload ->> 'email'))
        )
      FOR UPDATE;

      IF contact_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_contact_reuse_resolution_invalid';
      END IF;

      INSERT INTO pg_temp.ma_cutover_identity_map (
        entity_kind,
        temporary_entity_id,
        canonical_id
      ) VALUES ('contact', contact_stage.temporary_entity_id, contact_id);
    END IF;

    IF stage_row.resolution_action = 'reuse' THEN
      IF contact_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_affiliation_reuse_requires_reused_contact';
      END IF;

      SELECT affiliation.id
      INTO affiliation_id
      FROM public.ma_contact_office_affiliations affiliation
      WHERE affiliation.id = stage_row.reuse_canonical_id
        AND affiliation.contact_id = contact_id
        AND affiliation.office_id = office_id
        AND affiliation.is_active
      FOR UPDATE;

      IF affiliation_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_affiliation_reuse_resolution_invalid';
      END IF;
    ELSIF contact_id IS NULL THEN
      -- New contacts never auto-reuse a person merely because an email or name
      -- resembles one. The reviewer must stage an explicit reuse resolution.
      normalized_contact_key := CASE
        WHEN NULLIF(BTRIM(contact_stage.normalized_payload ->> 'email'), '') IS NOT NULL
          THEN 'email:' || LOWER(BTRIM(contact_stage.normalized_payload ->> 'email'))
        WHEN NULLIF(BTRIM(contact_stage.normalized_payload ->> 'firstName'), '') IS NOT NULL
          AND NULLIF(BTRIM(contact_stage.normalized_payload ->> 'lastName'), '') IS NOT NULL
          THEN 'name:'
            || LOWER(BTRIM(contact_stage.normalized_payload ->> 'firstName'))
            || ':'
            || LOWER(BTRIM(contact_stage.normalized_payload ->> 'lastName'))
        ELSE 'stage:' || contact_stage.temporary_entity_id
      END;
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('ma_cutover_contact:' || normalized_contact_key)
      );

      IF EXISTS (
        SELECT 1
        FROM public.ma_contacts contact
        WHERE contact.status = 'active'
          AND (
            (
              NULLIF(BTRIM(contact_stage.normalized_payload ->> 'email'), '') IS NOT NULL
              AND LOWER(BTRIM(contact.email)) = LOWER(BTRIM(contact_stage.normalized_payload ->> 'email'))
            )
            OR (
              NULLIF(BTRIM(contact_stage.normalized_payload ->> 'firstName'), '') IS NOT NULL
              AND NULLIF(BTRIM(contact_stage.normalized_payload ->> 'lastName'), '') IS NOT NULL
              AND LOWER(BTRIM(contact.first_name)) = LOWER(BTRIM(contact_stage.normalized_payload ->> 'firstName'))
              AND LOWER(BTRIM(contact.last_name)) = LOWER(BTRIM(contact_stage.normalized_payload ->> 'lastName'))
            )
          )
        FOR KEY SHARE
      ) THEN
        RAISE EXCEPTION 'ma_cutover_stage_contact_collision_requires_explicit_reuse';
      END IF;

      SELECT created.contact_id, created.affiliation_id
      INTO contact_id, affiliation_id
      FROM public.create_or_affiliate_ma_contact(
        office_id,
        NULL,
        NULLIF(BTRIM(contact_stage.normalized_payload ->> 'firstName'), ''),
        NULLIF(BTRIM(contact_stage.normalized_payload ->> 'lastName'), ''),
        NULLIF(BTRIM(contact_stage.normalized_payload ->> 'email'), ''),
        NULLIF(BTRIM(contact_stage.normalized_payload ->> 'phone'), ''),
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'jobTitle'), ''),
        BTRIM(p_actor)
      ) AS created;

      INSERT INTO pg_temp.ma_cutover_identity_map (
        entity_kind,
        temporary_entity_id,
        canonical_id
      ) VALUES ('contact', contact_stage.temporary_entity_id, contact_id);
    ELSE
      IF EXISTS (
        SELECT 1
        FROM public.ma_contact_office_affiliations affiliation
        WHERE affiliation.contact_id = contact_id
          AND affiliation.office_id = office_id
          AND affiliation.is_active
        FOR KEY SHARE
      ) THEN
        RAISE EXCEPTION 'ma_cutover_stage_affiliation_collision_requires_explicit_reuse';
      END IF;

      SELECT created.contact_id, created.affiliation_id
      INTO contact_id, affiliation_id
      FROM public.create_or_affiliate_ma_contact(
        office_id,
        contact_id,
        NULL,
        NULL,
        NULL,
        NULL,
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'jobTitle'), ''),
        BTRIM(p_actor)
      ) AS created;
    END IF;

    INSERT INTO pg_temp.ma_cutover_identity_map (
      entity_kind,
      temporary_entity_id,
      canonical_id
    ) VALUES ('affiliation', stage_row.temporary_entity_id, affiliation_id);
  END LOOP;

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'opportunity'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    SELECT map.canonical_id
    INTO office_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'office'
      AND map.temporary_entity_id = stage_row.parent_temporary_entity_id;

    SELECT ARRAY_AGG(map.canonical_id ORDER BY map.canonical_id)
    INTO affiliation_ids
    FROM JSONB_ARRAY_ELEMENTS_TEXT(stage_row.related_temporary_entity_ids) relation(temporary_entity_id)
    JOIN pg_temp.ma_cutover_identity_map map
      ON map.entity_kind = 'affiliation'
      AND map.temporary_entity_id = relation.temporary_entity_id;

    SELECT map.canonical_id
    INTO primary_affiliation_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'affiliation'
      AND map.temporary_entity_id = stage_row.normalized_payload ->> 'primaryAffiliationTemporaryId';

    IF office_id IS NULL
      OR COALESCE(CARDINALITY(affiliation_ids), 0) <> JSONB_ARRAY_LENGTH(stage_row.related_temporary_entity_ids)
      OR primary_affiliation_id IS NULL
      OR NOT (primary_affiliation_id = ANY(affiliation_ids)) THEN
      RAISE EXCEPTION 'ma_cutover_stage_opportunity_contact_mapping_required';
    END IF;

    IF NULLIF(BTRIM(stage_row.normalized_payload ->> 'reference'), '') IS NULL
      OR NULLIF(BTRIM(stage_row.normalized_payload ->> 'description'), '') IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_opportunity_reference_and_description_required';
    END IF;

    -- Synthetic rehearsal can show an invalid source value as null so staff
    -- sees the reconciliation outcome. A real staged value cannot silently be
    -- laundered at activation: malformed, nonblank metrics and dates must be
    -- resolved as blockers before the immutable digest is approved.
    staged_revenue_meur := NULLIF(
      BTRIM(stage_row.normalized_payload ->> 'revenueMeur'),
      ''
    );
    staged_ebitda_keur := NULLIF(
      BTRIM(stage_row.normalized_payload ->> 'ebitdaKeur'),
      ''
    );
    staged_headcount := NULLIF(
      BTRIM(stage_row.normalized_payload ->> 'headcount'),
      ''
    );
    staged_date_added := NULLIF(
      BTRIM(stage_row.normalized_payload ->> 'dateAdded'),
      ''
    );

    IF staged_revenue_meur IS NOT NULL
      AND staged_revenue_meur !~ '^-?[0-9]{1,10}([.][0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'ma_cutover_stage_revenue_meur_invalid';
    END IF;

    IF staged_ebitda_keur IS NOT NULL
      AND staged_ebitda_keur !~ '^-?[0-9]{1,10}([.][0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'ma_cutover_stage_ebitda_keur_invalid';
    END IF;

    IF staged_headcount IS NOT NULL
      AND (
        staged_headcount !~ '^[0-9]+$'
        OR LENGTH(LTRIM(staged_headcount, '0')) > 10
        OR (
          LENGTH(LTRIM(staged_headcount, '0')) = 10
          AND LTRIM(staged_headcount, '0') > '2147483647'
        )
      ) THEN
      RAISE EXCEPTION 'ma_cutover_stage_headcount_invalid';
    END IF;

    IF staged_date_added IS NOT NULL
      AND (
        CASE
          WHEN staged_date_added
            ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
            THEN TO_CHAR(
              TO_DATE(staged_date_added, 'FXYYYY-MM-DD'),
              'YYYY-MM-DD'
            ) <> staged_date_added
          ELSE TRUE
        END
      ) THEN
      RAISE EXCEPTION 'ma_cutover_stage_date_added_invalid';
    END IF;

    target_status := CASE stage_row.normalized_payload ->> 'targetStatus'
      WHEN 'active' THEN 'active'::public.opportunity_status
      WHEN 'paused' THEN 'paused'::public.opportunity_status
      ELSE NULL
    END;
    IF target_status IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_stage_opportunity_target_status_invalid';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      WHERE opportunity.reference = BTRIM(stage_row.normalized_payload ->> 'reference')
      FOR KEY SHARE
    ) THEN
      RAISE EXCEPTION 'ma_cutover_stage_opportunity_reference_already_exists';
    END IF;

    -- The approved manifest controls which optional canonical fields may be
    -- written. A field must be both explicitly allowed and explicitly staged.
    -- Geography is never inferred or written as a new code in W-020.
    -- Missing values remain null. The validation above rejects malformed
    -- nonblank values before any canonical write can start.
    optional_fields := JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
      'sector', CASE
        WHEN approved_optional_fields ? 'sector'
          AND stage_row.normalized_payload ? 'sector'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'sector'), '')
        ELSE NULL
      END,
      'activity', CASE
        WHEN approved_optional_fields ? 'activity'
          AND stage_row.normalized_payload ? 'activity'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'activity'), '')
        ELSE NULL
      END,
      'location', CASE
        WHEN approved_optional_fields ? 'location'
          AND stage_row.normalized_payload ? 'location'
          AND stage_row.normalized_payload ->> 'locationDecision' = 'approved'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'location'), '')
        ELSE NULL
      END,
      'revenue_meur', CASE
        WHEN approved_optional_fields ? 'revenue_meur'
          AND stage_row.normalized_payload ? 'revenueMeur'
          AND staged_revenue_meur IS NOT NULL
        THEN staged_revenue_meur::NUMERIC
        ELSE NULL
      END,
      'ebitda_keur', CASE
        WHEN approved_optional_fields ? 'ebitda_keur'
          AND stage_row.normalized_payload ? 'ebitdaKeur'
          AND staged_ebitda_keur IS NOT NULL
        THEN staged_ebitda_keur::NUMERIC
        ELSE NULL
      END,
      'headcount', CASE
        WHEN approved_optional_fields ? 'headcount'
          AND stage_row.normalized_payload ? 'headcount'
          AND staged_headcount IS NOT NULL
        THEN staged_headcount::INTEGER
        ELSE NULL
      END,
      'headcount_range', CASE
        WHEN approved_optional_fields ? 'headcount_range'
          AND stage_row.normalized_payload ? 'headcountRange'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'headcountRange'), '')
        ELSE NULL
      END,
      'date_added', CASE
        WHEN approved_optional_fields ? 'date_added'
          AND stage_row.normalized_payload ? 'dateAdded'
          AND staged_date_added IS NOT NULL
        THEN staged_date_added
        ELSE NULL
      END,
      'public_title', CASE
        WHEN approved_optional_fields ? 'public_title'
          AND stage_row.normalized_payload ? 'publicTitle'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'publicTitle'), '')
        ELSE NULL
      END,
      'teaser_summary', CASE
        WHEN approved_optional_fields ? 'teaser_summary'
          AND stage_row.normalized_payload ? 'teaserSummary'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'teaserSummary'), '')
        ELSE NULL
      END,
      'internal_notes', CASE
        WHEN approved_optional_fields ? 'internal_notes'
          AND stage_row.normalized_payload ? 'internalNotes'
        THEN NULLIF(BTRIM(stage_row.normalized_payload ->> 'internalNotes'), '')
        ELSE NULL
      END
    ));

    -- The final JSONB argument is the W-061 strict optional-field allowlist.
    -- W-061 owns this primitive; no legacy firm-level source field is supplied.
    SELECT *
    INTO created_opportunity
    FROM public.create_opportunity_with_office_context(
      BTRIM(stage_row.normalized_payload ->> 'reference'),
      office_id,
      affiliation_ids,
      primary_affiliation_id,
      BTRIM(stage_row.normalized_payload ->> 'description'),
      target_status,
      BTRIM(p_actor),
      optional_fields
    );

    PERFORM public.assert_opportunity_office_context(created_opportunity.id);
    created_opportunities := created_opportunities + 1;
  END LOOP;

  SELECT COUNT(*) INTO mapped_firms
  FROM pg_temp.ma_cutover_identity_map
  WHERE entity_kind = 'firm';
  SELECT COUNT(*) INTO mapped_offices
  FROM pg_temp.ma_cutover_identity_map
  WHERE entity_kind = 'office';
  SELECT COUNT(*) INTO mapped_contacts
  FROM pg_temp.ma_cutover_identity_map
  WHERE entity_kind = 'contact';
  SELECT COUNT(*) INTO mapped_affiliations
  FROM pg_temp.ma_cutover_identity_map
  WHERE entity_kind = 'affiliation';

  IF mapped_firms <> expected_firms
    OR mapped_offices <> expected_offices
    OR mapped_contacts <> expected_contacts
    OR mapped_affiliations <> expected_affiliations
    OR created_opportunities <> expected_opportunities THEN
    RAISE EXCEPTION 'ma_cutover_activation_count_reconciliation_failed';
  END IF;

  result := JSONB_BUILD_OBJECT(
    'firms_mapped', mapped_firms,
    'offices_mapped', mapped_offices,
    'contacts_mapped', mapped_contacts,
    'affiliations_mapped', mapped_affiliations,
    'opportunities_created', created_opportunities,
    'staging_purged', TRUE
  );

  -- Deleting issues first makes the purge explicit; stage-row deletion then
  -- removes the temporary source locator and every cross-sheet mapping.
  DELETE FROM public.ma_cutover_stage_issues
  WHERE run_id = run_row.id;
  DELETE FROM public.ma_cutover_stage_rows
  WHERE run_id = run_row.id;

  UPDATE public.ma_cutover_runs
  SET
    status = 'activated',
    activated_by = BTRIM(p_actor),
    activated_at = NOW(),
    result_summary = result
  WHERE id = run_row.id;

  RETURN result;
END;
$$;

ALTER TABLE public.ma_cutover_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_cutover_stage_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_cutover_stage_issues ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.ma_cutover_runs,
  public.ma_cutover_stage_rows,
  public.ma_cutover_stage_issues
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ma_cutover_runs,
  public.ma_cutover_stage_rows,
  public.ma_cutover_stage_issues
TO service_role;

REVOKE ALL ON FUNCTION public.update_ma_cutover_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_ma_cutover_run_immutability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_ma_cutover_stage_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_ma_cutover_run(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ma_cutover_run(UUID, TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.ma_cutover_runs IS
  'Service-role-only one-time cutover manifest. Retains source fingerprint/hash, aggregate reconciliation, decisions, actor/times and immutable approval digest; never workbook bytes or source row identifiers.';
COMMENT ON TABLE public.ma_cutover_stage_rows IS
  'Temporary service-role-only normalized cutover rows. Holds source row identifiers and cross-sheet mapping only until transactional activation succeeds.';
COMMENT ON TABLE public.ma_cutover_stage_issues IS
  'Temporary service-role-only cutover exceptions. Unresolved blockers prohibit activation and all rows are purged after a successful activation.';
COMMENT ON FUNCTION public.activate_ma_cutover_run(UUID, TEXT, TEXT) IS
  'Security-invoker, service-role-only one-time cutover activation. It receives and compares the approved immutable digest, locks the manifest, rejects unresolved blockers, creates the canonical dependency chain through W-061 primitives, verifies validity and purges stage rows/issues atomically.';

COMMIT;
