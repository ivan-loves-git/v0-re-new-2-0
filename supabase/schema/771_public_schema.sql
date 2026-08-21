--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: app_user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."app_user_role" AS ENUM (
    'staff',
    'repreneur'
);


--
-- Name: external_pursuit_audit_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."external_pursuit_audit_event_type" AS ENUM (
    'created',
    'updated',
    'contact_created',
    'contact_updated',
    'delete_requested',
    'deleted'
);


--
-- Name: external_pursuit_availability; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."external_pursuit_availability" AS ENUM (
    'available',
    'limited',
    'unavailable',
    'unknown'
);


--
-- Name: external_pursuit_deletion_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."external_pursuit_deletion_status" AS ENUM (
    'active',
    'delete_requested',
    'deleted'
);


--
-- Name: external_pursuit_responsible_party; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."external_pursuit_responsible_party" AS ENUM (
    'owner',
    'staff'
);


--
-- Name: external_pursuit_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."external_pursuit_stage" AS ENUM (
    'identified',
    'contact_qualification',
    'information',
    'meetings',
    'negotiation',
    'loi',
    'due_diligence_financing',
    'completed',
    'dropped_archived'
);


--
-- Name: lifecycle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."lifecycle_status" AS ENUM (
    'lead',
    'qualified',
    'client',
    'rejected',
    'declined',
    'to_reactivate'
);


--
-- Name: ma_contact_email_purpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."ma_contact_email_purpose" AS ENUM (
    'campaign',
    'general_relationship',
    'opportunity_general',
    'opportunity_nda_request'
);


--
-- Name: ma_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."ma_source_type" AS ENUM (
    'ma_firm',
    'broker',
    'direct',
    'other'
);


--
-- Name: opportunity_closure_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_closure_reason" AS ENUM (
    'stale',
    'sold',
    'signed_repreneur',
    'paused_cabinet',
    'withdrawn_seller',
    'no_viable_match',
    'dd_disqualified',
    'duplicate'
);


--
-- Name: opportunity_document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_document_type" AS ENUM (
    'teaser',
    'deal_book',
    'nda',
    'external_analysis',
    'other',
    'source_teaser'
);


--
-- Name: opportunity_document_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_document_visibility" AS ENUM (
    'staff_only',
    'approved_for_repreneur'
);


--
-- Name: opportunity_match_recommendation; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_match_recommendation" AS ENUM (
    'not_evaluated',
    'strong_fit',
    'possible_fit',
    'weak_fit',
    'not_fit'
);


--
-- Name: opportunity_match_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_match_status" AS ENUM (
    'draft',
    'shortlisted',
    'proposed',
    'interested',
    'declined',
    'active_pursuit',
    'dropped',
    'completed'
);


--
-- Name: opportunity_nda_artifact_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_nda_artifact_role" AS ENUM (
    'blank_template',
    'renew_signed_copy',
    'repreneur_signed_copy'
);


--
-- Name: opportunity_nda_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_nda_status" AS ENUM (
    'not_required',
    'required',
    'sent',
    'signed',
    'waived'
);


--
-- Name: opportunity_pursuit_evidence_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_pursuit_evidence_type" AS ENUM (
    'mutual_interest_validated',
    'qualification_requested',
    'intermediary_qualified',
    'template_validated',
    'gate_1_passed',
    'renew_signed_copy_validated',
    'repreneur_signed_copy_validated',
    'gate_2_passed',
    'manual_package_dispatched',
    'confidential_access_granted',
    'access_revoked',
    'continued',
    'dropped',
    'reopened',
    'completed'
);


--
-- Name: opportunity_pursuit_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_pursuit_stage" AS ENUM (
    'interest',
    'info_memo_received',
    'intermediary_meeting',
    'seller_meeting',
    'loi',
    'closed',
    'dropped'
);


--
-- Name: opportunity_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_status" AS ENUM (
    'draft',
    'active',
    'paused',
    'archived',
    'closed'
);


--
-- Name: opportunity_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."opportunity_visibility" AS ENUM (
    'staff_only',
    'anonymized',
    'repreneur_visible'
);


--
-- Name: repreneur_offer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."repreneur_offer_status" AS ENUM (
    'offered',
    'accepted',
    'active',
    'completed',
    'expired',
    'declined'
);


--
-- Name: activate_ma_cutover_run("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."activate_ma_cutover_run"("p_run_id" "uuid", "p_approval_digest" "text", "p_actor" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  run_row public.ma_cutover_runs%ROWTYPE;
  stage_row public.ma_cutover_stage_rows%ROWTYPE;
  contact_stage public.ma_cutover_stage_rows%ROWTYPE;
  resolved_firm_id UUID;
  resolved_office_id UUID;
  resolved_contact_id UUID;
  resolved_affiliation_id UUID;
  resolved_primary_affiliation_id UUID;
  resolved_affiliation_ids UUID[];
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
  computed_approval_digest TEXT;
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

  -- The digest is recomputed only after the run, every staged row and every
  -- issue are locked. This compares the persisted approval with the exact
  -- snapshot that activation is about to consume.
  computed_approval_digest := public.compute_ma_cutover_approval_digest(run_row.id);

  IF BTRIM(run_row.approval_digest) IS DISTINCT FROM computed_approval_digest THEN
    RAISE EXCEPTION 'ma_cutover_stored_approval_digest_mismatch';
  END IF;

  IF BTRIM(p_approval_digest) IS DISTINCT FROM computed_approval_digest THEN
    RAISE EXCEPTION 'ma_cutover_activation_digest_mismatch';
  END IF;

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

  CREATE TEMP TABLE IF NOT EXISTS ma_cutover_activation_guard (
    run_id UUID PRIMARY KEY
  ) ON COMMIT DROP;
  INSERT INTO ma_cutover_activation_guard (run_id)
  VALUES (run_row.id)
  ON CONFLICT (run_id) DO NOTHING;

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

    resolved_firm_id := NULL;
    IF stage_row.resolution_action = 'reuse' THEN
      SELECT firm.id
      INTO resolved_firm_id
      FROM public.ma_firms firm
      WHERE firm.id = stage_row.reuse_canonical_id
        AND firm.status <> 'archived'
        AND LOWER(BTRIM(firm.name)) = LOWER(normalized_name)
      FOR UPDATE;

      IF resolved_firm_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_firm_reuse_resolution_invalid';
      END IF;
    ELSE
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(LOWER(BTRIM(normalized_name)), 76061)
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
      RETURNING id INTO resolved_firm_id;
    END IF;

    INSERT INTO pg_temp.ma_cutover_identity_map (
      entity_kind,
      temporary_entity_id,
      canonical_id
    ) VALUES ('firm', stage_row.temporary_entity_id, resolved_firm_id);
  END LOOP;

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'office'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    SELECT map.canonical_id
    INTO resolved_firm_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'firm'
      AND map.temporary_entity_id = stage_row.parent_temporary_entity_id;

    normalized_name := NULLIF(BTRIM(stage_row.normalized_payload ->> 'name'), '');
    IF resolved_firm_id IS NULL OR normalized_name IS NULL THEN
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
    WHERE firm.id = resolved_firm_id
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
        WHERE office.firm_id = resolved_firm_id
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
          AND staged_parent_firm.canonical_id = resolved_firm_id
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

    resolved_office_id := NULL;
    IF stage_row.resolution_action = 'reuse' THEN
      SELECT office.id
      INTO resolved_office_id
      FROM public.ma_offices office
      WHERE office.id = stage_row.reuse_canonical_id
        AND office.firm_id = resolved_firm_id
        AND office.status = 'active'
        AND office.is_default = use_synthetic_default
        AND LOWER(BTRIM(office.name)) = LOWER(normalized_name)
      FOR UPDATE;

      IF resolved_office_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_office_reuse_resolution_invalid';
      END IF;
    ELSE
      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext(
          'ma_cutover_office:' || resolved_firm_id::TEXT || ':' || LOWER(normalized_name)
        )
      );

      IF EXISTS (
        SELECT 1
        FROM public.ma_offices office
        WHERE office.firm_id = resolved_firm_id
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
        resolved_firm_id,
        normalized_name,
        'active',
        use_synthetic_default,
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'city'), ''),
        NULLIF(BTRIM(stage_row.normalized_payload ->> 'internalNotes'), ''),
        BTRIM(p_actor),
        BTRIM(p_actor)
      )
      RETURNING id INTO resolved_office_id;
    END IF;

    INSERT INTO pg_temp.ma_cutover_identity_map (
      entity_kind,
      temporary_entity_id,
      canonical_id
    ) VALUES ('office', stage_row.temporary_entity_id, resolved_office_id);
  END LOOP;

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'affiliation'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    SELECT map.canonical_id
    INTO resolved_office_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'office'
      AND map.temporary_entity_id = stage_row.related_temporary_entity_ids ->> 0;

    IF resolved_office_id IS NULL
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
    INTO resolved_contact_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'contact'
      AND map.temporary_entity_id = contact_stage.temporary_entity_id;

    IF resolved_contact_id IS NULL AND contact_stage.resolution_action = 'reuse' THEN
      SELECT contact.id
      INTO resolved_contact_id
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

      IF resolved_contact_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_contact_reuse_resolution_invalid';
      END IF;

      INSERT INTO pg_temp.ma_cutover_identity_map (
        entity_kind,
        temporary_entity_id,
        canonical_id
      ) VALUES ('contact', contact_stage.temporary_entity_id, resolved_contact_id);
    END IF;

    IF stage_row.resolution_action = 'reuse' THEN
      IF resolved_contact_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_affiliation_reuse_requires_reused_contact';
      END IF;

      SELECT affiliation.id
      INTO resolved_affiliation_id
      FROM public.ma_contact_office_affiliations affiliation
      WHERE affiliation.id = stage_row.reuse_canonical_id
        AND affiliation.contact_id = resolved_contact_id
        AND affiliation.office_id = resolved_office_id
        AND affiliation.is_active
      FOR UPDATE;

      IF resolved_affiliation_id IS NULL THEN
        RAISE EXCEPTION 'ma_cutover_stage_affiliation_reuse_resolution_invalid';
      END IF;
    ELSIF resolved_contact_id IS NULL THEN
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
      INTO resolved_contact_id, resolved_affiliation_id
      FROM public.create_or_affiliate_ma_contact(
        resolved_office_id,
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
      ) VALUES ('contact', contact_stage.temporary_entity_id, resolved_contact_id);
    ELSE
      IF EXISTS (
        SELECT 1
        FROM public.ma_contact_office_affiliations affiliation
        WHERE affiliation.contact_id = resolved_contact_id
          AND affiliation.office_id = resolved_office_id
          AND affiliation.is_active
        FOR KEY SHARE
      ) THEN
        RAISE EXCEPTION 'ma_cutover_stage_affiliation_collision_requires_explicit_reuse';
      END IF;

      SELECT created.contact_id, created.affiliation_id
      INTO resolved_contact_id, resolved_affiliation_id
      FROM public.create_or_affiliate_ma_contact(
        resolved_office_id,
        resolved_contact_id,
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
    ) VALUES ('affiliation', stage_row.temporary_entity_id, resolved_affiliation_id);
  END LOOP;

  FOR stage_row IN
    SELECT *
    FROM public.ma_cutover_stage_rows row
    WHERE row.run_id = run_row.id
      AND row.entity_kind = 'opportunity'
    ORDER BY row.temporary_entity_id, row.id
  LOOP
    SELECT map.canonical_id
    INTO resolved_office_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'office'
      AND map.temporary_entity_id = stage_row.parent_temporary_entity_id;

    SELECT ARRAY_AGG(map.canonical_id ORDER BY map.canonical_id)
    INTO resolved_affiliation_ids
    FROM JSONB_ARRAY_ELEMENTS_TEXT(stage_row.related_temporary_entity_ids) relation(temporary_entity_id)
    JOIN pg_temp.ma_cutover_identity_map map
      ON map.entity_kind = 'affiliation'
      AND map.temporary_entity_id = relation.temporary_entity_id;

    SELECT map.canonical_id
    INTO resolved_primary_affiliation_id
    FROM pg_temp.ma_cutover_identity_map map
    WHERE map.entity_kind = 'affiliation'
      AND map.temporary_entity_id = stage_row.normalized_payload ->> 'primaryAffiliationTemporaryId';

    IF resolved_office_id IS NULL
      OR COALESCE(CARDINALITY(resolved_affiliation_ids), 0) <> JSONB_ARRAY_LENGTH(stage_row.related_temporary_entity_ids)
      OR resolved_primary_affiliation_id IS NULL
      OR NOT (resolved_primary_affiliation_id = ANY(resolved_affiliation_ids)) THEN
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
      resolved_office_id,
      resolved_affiliation_ids,
      resolved_primary_affiliation_id,
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
$_$;


--
-- Name: activate_w039_geography_mandates("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."activate_w039_geography_mandates"("p_actor" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN RAISE EXCEPTION 'w039_activation_actor_required'; END IF;
  UPDATE public.ma_w039_release_control SET enforce_new_opportunity_geography = TRUE, activated_by = BTRIM(p_actor), activated_at = NOW() WHERE singleton;
END $$;


--
-- Name: apply_w039_geography_adoption("text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."apply_w039_geography_adoption"("p_source_hash" "text", "p_actor" "text", "p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE row_count INTEGER; adoption_run UUID; computed_payload_digest TEXT; changed_count INTEGER;
BEGIN
  IF p_source_hash <> 'a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5' THEN RAISE EXCEPTION 'w039_geography_source_hash_not_approved'; END IF;
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN RAISE EXCEPTION 'w039_geography_actor_required'; END IF;
  IF pg_catalog.to_regclass('public.ma_cutover_runs') IS NULL
     OR (SELECT COUNT(*) FROM public.ma_cutover_runs WHERE status = 'activated') <> 1 THEN
    RAISE EXCEPTION 'w039_geography_requires_one_activated_cutover_manifest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ma_cutover_runs WHERE status = 'activated' AND source_hash = p_source_hash) THEN
    RAISE EXCEPTION 'w039_geography_cutover_source_hash_mismatch';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS w039_rows(reference TEXT PRIMARY KEY, source_code TEXT, target_stable_key TEXT, location_digest TEXT NOT NULL) ON COMMIT DROP;
  TRUNCATE TABLE w039_rows;
  INSERT INTO w039_rows SELECT item.value ->> 'reference', item.value ->> 'sourceGeographyCode', NULLIF(item.value ->> 'geographyStableKey',''), item.value ->> 'locationDigest' FROM JSONB_ARRAY_ELEMENTS(p_payload -> 'rows') AS item(value);
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count <> 148 OR EXISTS (SELECT 1 FROM w039_rows WHERE NULLIF(BTRIM(reference),'') IS NULL OR (source_code IS NOT NULL AND source_code !~ '^[A-Z]{2,3}$') OR location_digest !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'w039_geography_payload_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM w039_rows r LEFT JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key WHERE r.target_stable_key IS NOT NULL AND n.id IS NULL) THEN RAISE EXCEPTION 'w039_geography_payload_unknown_france_node'; END IF;
  IF EXISTS (
    SELECT 1 FROM w039_rows row
    LEFT JOIN (VALUES
      ('FR','france'),('IDF','fr-region-idf'),('NE','fr-macro-north-east'),('GO','fr-macro-great-west'),('SO','fr-macro-south-west'),('SE','fr-macro-south-east'),('OM','fr-macro-overseas'),('AU','fr-region-auvergne-rhone-alpes'),('NA','fr-region-nouvelle-aquitaine'),('OC','fr-region-occitanie'),('PA','fr-region-provence-alpes-cote-d-azur'),('COR','fr-region-corsica'),('BR','fr-region-brittany'),('NO','fr-region-normandy'),('PL','fr-region-pays-de-la-loire'),('CVL','fr-region-centre-val-de-loire'),('HDF','fr-region-hauts-de-france'),('GE','fr-region-grand-est'),('BFR','fr-region-bourgogne-franche-comte'),('BFC','fr-region-bourgogne-franche-comte'),('DOM','fr-region-overseas')
    ) approved(source_code, stable_key) ON approved.source_code = row.source_code
    WHERE approved.stable_key IS DISTINCT FROM row.target_stable_key
  ) THEN RAISE EXCEPTION 'w039_geography_source_mapping_not_approved'; END IF;
  IF EXISTS (SELECT 1 FROM w039_rows r JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key WHERE r.source_code IN ('DE','BE','ES','IT','LU','MC','NL','PT','GB','CH')) THEN RAISE EXCEPTION 'w039_geography_foreign_node_not_allowed'; END IF;
  IF (SELECT COUNT(*) FROM public.opportunities o JOIN w039_rows r ON LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference))) <> 148 THEN RAISE EXCEPTION 'w039_geography_live_opportunity_count_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.opportunities o JOIN w039_rows r ON LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference)) WHERE ENCODE(extensions.digest(CONVERT_TO(COALESCE(o.location,''),'UTF8'),'sha256'),'hex') <> r.location_digest) THEN RAISE EXCEPTION 'w039_geography_location_changed_after_preflight'; END IF;
  computed_payload_digest := ENCODE(extensions.digest(CONVERT_TO(p_payload::TEXT,'UTF8'),'sha256'),'hex');
  -- No run row exists to lock before the first application. Serialize by the
  -- immutable source hash so concurrent identical calls become a clean replay
  -- and a concurrent changed payload fails after the first transaction ends.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_hash, 92039));
  IF EXISTS (SELECT 1 FROM public.ma_w039_geography_adoption_runs run WHERE run.source_hash = p_source_hash AND run.payload_digest = computed_payload_digest) THEN
    RETURN JSONB_BUILD_OBJECT('idempotent_replay',TRUE);
  END IF;
  IF EXISTS (SELECT 1 FROM public.ma_w039_geography_adoption_runs WHERE source_hash = p_source_hash) THEN
    RAISE EXCEPTION 'w039_geography_adoption_payload_mismatch';
  END IF;
  INSERT INTO public.ma_w039_geography_adoption_runs(source_hash,payload_digest,applied_by) VALUES(p_source_hash,computed_payload_digest,p_actor) RETURNING id INTO adoption_run;
  INSERT INTO public.ma_w039_geography_adoption_evidence(run_id,opportunity_id,source_geography_code,target_stable_key,geography_node_before,geography_node_after,location_digest,outcome)
  SELECT adoption_run,o.id,r.source_code,r.target_stable_key,o.geography_node_id,CASE WHEN o.geography_node_id IS NULL THEN n.id ELSE o.geography_node_id END,r.location_digest,CASE WHEN r.target_stable_key IS NULL THEN 'review_outside_france' WHEN o.geography_node_id IS NULL THEN 'applied' WHEN o.geography_node_id = n.id THEN 'already_canonical' ELSE 'preserved_wave_edit' END
  FROM public.opportunities o JOIN w039_rows r ON LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference)) LEFT JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key;
  UPDATE public.opportunities o SET geography_node_id = n.id, updated_by = p_actor, updated_at = NOW() FROM w039_rows r JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key WHERE LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference)) AND o.geography_node_id IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN JSONB_BUILD_OBJECT('run_id',adoption_run,'applied_rows',changed_count,'idempotent_replay',FALSE);
END $_$;


--
-- Name: external_pursuits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_repreneur_id" "uuid" NOT NULL,
    "title" "text",
    "stage" "public"."external_pursuit_stage" DEFAULT 'identified'::"public"."external_pursuit_stage" NOT NULL,
    "availability" "public"."external_pursuit_availability" DEFAULT 'unknown'::"public"."external_pursuit_availability" NOT NULL,
    "due_at" "date",
    "deletion_status" "public"."external_pursuit_deletion_status" DEFAULT 'active'::"public"."external_pursuit_deletion_status" NOT NULL,
    "create_idempotency_key" "text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_by" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "external_url" "text",
    "target_company" "text",
    "source_channel" "text",
    "revenue_meur" numeric,
    "ebitda_keur" numeric,
    "headcount" integer,
    "next_action" "text",
    "responsible_party" "public"."external_pursuit_responsible_party",
    "last_confirmed_at" timestamp with time zone,
    "last_confirmed_by" "text",
    CONSTRAINT "external_pursuits_check" CHECK (((("deletion_status" <> 'deleted'::"public"."external_pursuit_deletion_status") AND (NULLIF("btrim"("title"), ''::"text") IS NOT NULL)) OR ("deletion_status" = 'deleted'::"public"."external_pursuit_deletion_status"))),
    CONSTRAINT "external_pursuits_create_idempotency_key_check" CHECK ((NULLIF("btrim"("create_idempotency_key"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuits_created_by_check" CHECK ((NULLIF("btrim"("created_by"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuits_ebitda_keur_nonnegative" CHECK ((("ebitda_keur" IS NULL) OR ("ebitda_keur" >= (0)::numeric))),
    CONSTRAINT "external_pursuits_headcount_nonnegative" CHECK ((("headcount" IS NULL) OR ("headcount" >= 0))),
    CONSTRAINT "external_pursuits_last_confirmation_actor_check" CHECK (((("last_confirmed_at" IS NULL) AND ("last_confirmed_by" IS NULL)) OR (("last_confirmed_at" IS NOT NULL) AND (NULLIF("btrim"("last_confirmed_by"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "external_pursuits_next_action_responsible_party_check" CHECK ((((NULLIF("btrim"("next_action"), ''::"text") IS NULL) AND ("responsible_party" IS NULL)) OR ((NULLIF("btrim"("next_action"), ''::"text") IS NOT NULL) AND ("responsible_party" IS NOT NULL)))),
    CONSTRAINT "external_pursuits_revenue_meur_nonnegative" CHECK ((("revenue_meur" IS NULL) OR ("revenue_meur" >= (0)::numeric))),
    CONSTRAINT "external_pursuits_updated_by_check" CHECK ((NULLIF("btrim"("updated_by"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."external_pursuits" FORCE ROW LEVEL SECURITY;


--
-- Name: assert_external_pursuit_access("uuid", "text", boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_external_pursuit_access"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_staff_only" boolean DEFAULT false) RETURNS "public"."external_pursuits"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; r public.app_user_role; owner_id UUID;
BEGIN
  SELECT * INTO p FROM public.external_pursuits WHERE id = p_dossier_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'External Pursuit not found.'; END IF;
  SELECT role, repreneur_id INTO r, owner_id FROM public.external_pursuit_actor_context(p_actor_user_id);
  IF r = 'staff' THEN RETURN p; END IF;
  IF p_staff_only OR r IS DISTINCT FROM 'repreneur' OR owner_id IS NULL OR owner_id <> p.owner_repreneur_id OR p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  RETURN p;
END $$;


--
-- Name: assert_external_pursuit_not_converted("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_external_pursuit_not_converted"("p_dossier_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.external_pursuit_opportunity_conversions conversion
    WHERE conversion.external_pursuit_id = p_dossier_id
  ) THEN
    RAISE EXCEPTION 'external_pursuit_already_converted';
  END IF;
END;
$$;


--
-- Name: assert_ma_firm_has_active_office("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_ma_firm_has_active_office"("p_firm_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  firm_row public.ma_firms%ROWTYPE;
BEGIN
  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = p_firm_id;

  IF firm_row.id IS NULL THEN
    RETURN;
  END IF;

  -- Archiving a firm is safe only after every live opportunity using one of
  -- its offices has been closed, archived or moved in the same transaction.
  IF firm_row.status = 'archived' THEN
    IF EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      JOIN public.ma_offices office
        ON office.id = opportunity.source_office_id
      WHERE office.firm_id = firm_row.id
        AND opportunity.status IN ('active', 'paused')
    ) THEN
      RAISE EXCEPTION 'ma_firm_archive_requires_resolving_active_opportunities';
    END IF;

    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_offices office
    WHERE office.firm_id = firm_row.id
      AND office.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ma_firm_requires_active_office';
  END IF;
END;
$$;


--
-- Name: assert_ma_provisional_source_context_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_ma_provisional_source_context_integrity"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  context_count INTEGER;
  firm_count INTEGER;
  office_count INTEGER;
  contact_email_count INTEGER;
  contact_name_count INTEGER;
  staff_identity_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO context_count
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF context_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_exactly_one_context';
  END IF;

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  SELECT COUNT(*)
  INTO firm_count
  FROM public.ma_firms firm
  WHERE LOWER(BTRIM(firm.name)) = 'acme co.';

  SELECT COUNT(*)
  INTO office_count
  FROM public.ma_offices office
  WHERE LOWER(BTRIM(office.name)) = 'acme paris';

  SELECT COUNT(*)
  INTO contact_email_count
  FROM public.ma_contacts contact
  WHERE LOWER(BTRIM(contact.email)) = 'TEST-schema-redacted-001';

  SELECT COUNT(*)
  INTO contact_name_count
  FROM public.ma_contacts contact
  WHERE LOWER(BTRIM(contact.display_name)) = 'TEST-schema-redacted-person';

  SELECT COUNT(*)
  INTO staff_identity_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff'
    AND LOWER(BTRIM(role.email)) = 'TEST-schema-redacted-002';

  IF firm_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_exactly_one_firm';
  END IF;
  IF office_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_exactly_one_office';
  END IF;
  IF contact_email_count <> 1 OR contact_name_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_one_qa_person_contact';
  END IF;
  IF staff_identity_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_one_qa_person_staff_identity';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    JOIN public.ma_offices office ON office.id = context_row.office_id
    JOIN public.ma_contacts contact ON contact.id = context_row.contact_id
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = context_row.affiliation_id
    WHERE firm.id = context_row.firm_id
      AND firm.name = 'Acme Co.'
      AND firm.status = 'active'
      AND firm.archived_at IS NULL
      AND office.firm_id = firm.id
      AND office.name = 'Acme Paris'
      AND office.city = 'Paris'
      AND office.status = 'active'
      AND office.archived_at IS NULL
      AND NOT office.is_default
      AND contact.display_name = 'TEST-schema-redacted-person'
      AND LOWER(BTRIM(contact.email)) = 'TEST-schema-redacted-003'
      AND contact.status = 'active'
      AND contact.archived_at IS NULL
      AND affiliation.contact_id = contact.id
      AND affiliation.office_id = office.id
      AND affiliation.is_active
      AND affiliation.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ma_provisional_acme_context_integrity_mismatch';
  END IF;
END;
$$;


--
-- Name: assert_ma_provisional_source_review_state("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_ma_provisional_source_review_state"("p_opportunity_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  opportunity_row public.opportunities%ROWTYPE;
  unresolved_assignment_count INTEGER;
BEGIN
  PERFORM public.assert_ma_provisional_source_context_integrity();

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF context_row.context_key IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF opportunity_row.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO unresolved_assignment_count
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.opportunity_id = opportunity_row.id
    AND assignment.provisional_office_id = context_row.office_id
    AND assignment.event_kind = 'assigned'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ma_provisional_source_review_events resolution
      WHERE resolution.event_kind = 'resolved'
        AND resolution.related_assignment_id = assignment.id
    );

  IF opportunity_row.source_office_id = context_row.office_id
    AND unresolved_assignment_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_requires_immutable_evidence';
  END IF;

  IF opportunity_row.source_office_id IS DISTINCT FROM context_row.office_id
    AND unresolved_assignment_count <> 0 THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_immutable_evidence';
  END IF;

  IF public.ma_opportunity_source_review_required(opportunity_row.id)
    AND opportunity_row.status IN ('closed', 'archived') THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit';
  END IF;
END;
$$;


--
-- Name: assert_opportunity_nda_artifact_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_opportunity_nda_artifact_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  linked_document_opportunity_id UUID;
  linked_document_type public.opportunity_document_type;
  linked_document_visibility public.opportunity_document_visibility;
  linked_document_storage_path TEXT;
  linked_document_external_url TEXT;
  linked_document_file_name TEXT;
  linked_document_mime_type TEXT;
  linked_document_size_bytes BIGINT;
  linked_match_opportunity_id UUID;
  prior_artifact public.opportunity_nda_artifacts;
BEGIN
  SELECT
    document.opportunity_id,
    document.document_type,
    document.visibility,
    NULLIF(BTRIM(document.storage_path), ''),
    NULLIF(BTRIM(document.external_url), ''),
    NULLIF(BTRIM(document.file_name), ''),
    NULLIF(BTRIM(document.mime_type), ''),
    document.size_bytes
  INTO
    linked_document_opportunity_id,
    linked_document_type,
    linked_document_visibility,
    linked_document_storage_path,
    linked_document_external_url,
    linked_document_file_name,
    linked_document_mime_type,
    linked_document_size_bytes
  FROM public.opportunity_documents document
  WHERE document.id = NEW.document_id;

  IF linked_document_opportunity_id IS NULL
    OR linked_document_opportunity_id <> NEW.opportunity_id
    OR linked_document_type <> 'nda'
    OR linked_document_visibility <> 'staff_only'
  THEN
    RAISE EXCEPTION
      'Canonical NDA artifact documents must be staff-only NDAs for the same opportunity.';
  END IF;

  IF linked_document_storage_path IS NULL
    OR linked_document_external_url IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Canonical NDA artifact documents require one retained private file.';
  END IF;

  IF linked_document_storage_path NOT LIKE
    NEW.opportunity_id::TEXT || '/nda-artifacts/' || NEW.artifact_role::TEXT || '/%'
    OR linked_document_file_name IS NULL
    OR linked_document_size_bytes IS NULL
    OR linked_document_size_bytes <= 0
  THEN
    RAISE EXCEPTION
      'Canonical stored NDA artifacts must be positive-size files in their role folder.';
  END IF;

  IF NEW.artifact_role = 'blank_template' THEN
    IF NOT (
      (LOWER(linked_document_file_name) LIKE '%.pdf' AND linked_document_mime_type = 'application/pdf')
      OR (
        LOWER(linked_document_file_name) LIKE '%.docx'
        AND linked_document_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ) THEN
      RAISE EXCEPTION 'Stored blank NDA templates must be PDF or DOCX files.';
    END IF;
  ELSIF LOWER(linked_document_file_name) NOT LIKE '%.pdf'
    OR linked_document_mime_type <> 'application/pdf'
  THEN
    RAISE EXCEPTION 'Signed NDA artifacts must be PDFs.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_documents other_document
    WHERE other_document.id <> NEW.document_id
      AND other_document.storage_bucket = 'opportunity-documents'
      AND other_document.storage_path = linked_document_storage_path
  ) THEN
    RAISE EXCEPTION
      'Canonical NDA artifact storage paths must be unique and may never be reused.';
  END IF;

  IF NEW.match_id IS NOT NULL THEN
    SELECT match.opportunity_id
    INTO linked_match_opportunity_id
    FROM public.opportunity_matches match
    WHERE match.id = NEW.match_id;

    IF linked_match_opportunity_id IS NULL
      OR linked_match_opportunity_id <> NEW.opportunity_id
    THEN
      RAISE EXCEPTION
        'Canonical NDA artifact pursuits must belong to the same opportunity.';
    END IF;
  END IF;

  IF NEW.version_number > 1 THEN
    SELECT prior.*
    INTO prior_artifact
    FROM public.opportunity_nda_artifacts prior
    WHERE prior.id = NEW.supersedes_artifact_id;

    IF prior_artifact.id IS NULL
      OR prior_artifact.opportunity_id <> NEW.opportunity_id
      OR prior_artifact.match_id IS DISTINCT FROM NEW.match_id
      OR prior_artifact.artifact_role <> NEW.artifact_role
      OR prior_artifact.version_number <> NEW.version_number - 1
    THEN
      RAISE EXCEPTION
        'Canonical NDA artifact versions must supersede the immediately previous version in the same scope and role.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: assert_opportunity_office_context("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_opportunity_office_context"("p_opportunity_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  office_row public.ma_offices%ROWTYPE;
  active_contact_count INTEGER;
  primary_contact_count INTEGER;
  primary_has_usable_email BOOLEAN;
BEGIN
  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF opportunity_row.id IS NULL THEN
    RETURN;
  END IF;

  IF opportunity_row.source_office_id IS NULL THEN
    IF opportunity_row.status IN ('active', 'paused') THEN
      RAISE EXCEPTION 'opportunity_activation_requires_source_office';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.opportunity_ma_contacts link
      WHERE link.opportunity_id = opportunity_row.id
        AND link.is_active
    ) THEN
      RAISE EXCEPTION 'opportunity_contact_requires_source_office';
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = opportunity_row.source_office_id;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_office_not_found';
  END IF;

  -- source_id and source_label are pre-076 compatibility evidence only. They
  -- do not determine or validate the canonical current source office, because
  -- an old opportunity may later be moved through the office model without
  -- rewriting its legacy history.

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    WHERE link.opportunity_id = opportunity_row.id
      AND link.is_active
      AND affiliation.office_id <> opportunity_row.source_office_id
  ) THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_office_mismatch';
  END IF;

  -- Closed and archived records retain their source and contact attribution.
  -- Their linked affiliation/contact may later end or archive without
  -- blocking that historical lifecycle. Office/link consistency remains above.
  IF opportunity_row.status IN ('closed', 'archived') THEN
    RETURN;
  END IF;

  -- The view and save RPC hide/reject this already. Keeping the same rule in
  -- the invariant blocks a direct service mutation from selecting a synthetic
  -- default once a real active office exists for that firm.
  IF office_row.is_default
    AND EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office_row.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    ) THEN
    RAISE EXCEPTION 'opportunity_source_office_requires_real_office_selection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
    WHERE link.opportunity_id = opportunity_row.id
      AND link.is_active
      AND (
        NOT affiliation.is_active
        OR contact.status <> 'active'
      )
  ) THEN
    RAISE EXCEPTION 'opportunity_active_contact_affiliation_must_be_active';
  END IF;

  IF opportunity_row.status NOT IN ('active', 'paused') THEN
    RETURN;
  END IF;

  IF office_row.status <> 'active' THEN
    RAISE EXCEPTION 'opportunity_activation_requires_active_source_office';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    WHERE firm.id = office_row.firm_id
      AND firm.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'opportunity_activation_requires_non_archived_source_firm';
  END IF;

  IF NULLIF(BTRIM(opportunity_row.description), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_activation_requires_description';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE link.is_primary),
    COALESCE(
      BOOL_OR(
        link.is_primary
        AND affiliation.is_active
        AND contact.status = 'active'
        AND (
          NULLIF(BTRIM(contact.first_name), '') IS NOT NULL
          OR NULLIF(BTRIM(contact.last_name), '') IS NOT NULL
        )
        AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
        AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      ),
      FALSE
    )
  INTO active_contact_count, primary_contact_count, primary_has_usable_email
  FROM public.opportunity_ma_contacts link
  JOIN public.ma_contact_office_affiliations affiliation
    ON affiliation.id = link.affiliation_id
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE link.opportunity_id = opportunity_row.id
    AND link.is_active;

  IF active_contact_count = 0 THEN
    RAISE EXCEPTION 'opportunity_activation_requires_contact';
  END IF;

  IF primary_contact_count <> 1 THEN
    RAISE EXCEPTION 'opportunity_activation_requires_exactly_one_primary_contact';
  END IF;

  IF NOT primary_has_usable_email THEN
    RAISE EXCEPTION 'opportunity_activation_requires_usable_primary_email';
  END IF;
END;
$_$;


--
-- Name: assert_opportunity_pursuit_evidence_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_opportunity_pursuit_evidence_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_artifact public.opportunity_nda_artifacts%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = NEW.match_id;
  IF v_match.id IS NULL OR v_match.opportunity_id <> NEW.opportunity_id OR v_match.repreneur_id <> NEW.repreneur_id THEN
    RAISE EXCEPTION 'Pursuit evidence must retain the exact match, opportunity and repreneur.';
  END IF;
  IF NEW.nda_artifact_id IS NOT NULL THEN
    SELECT * INTO v_artifact FROM public.opportunity_nda_artifacts WHERE id = NEW.nda_artifact_id;
    IF v_artifact.id IS NULL OR v_artifact.opportunity_id <> NEW.opportunity_id
      OR (v_artifact.match_id IS NOT NULL AND v_artifact.match_id <> NEW.match_id) THEN
      RAISE EXCEPTION 'Evidence artifact must belong to this opportunity and pursuit.';
    END IF;
  END IF;
  IF NEW.document_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM public.opportunity_documents WHERE id = NEW.document_id;
    IF v_doc.id IS NULL OR v_doc.opportunity_id <> NEW.opportunity_id THEN
      RAISE EXCEPTION 'Evidence document must belong to this opportunity.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference" "text" NOT NULL,
    "status" "public"."opportunity_status" DEFAULT 'draft'::"public"."opportunity_status" NOT NULL,
    "source_id" "uuid",
    "source_label" "text",
    "source_visibility" "public"."opportunity_visibility" DEFAULT 'staff_only'::"public"."opportunity_visibility" NOT NULL,
    "sector" "text",
    "activity" "text",
    "location" "text",
    "description" "text",
    "revenue_meur" numeric(12,2),
    "ebitda_keur" numeric(12,2),
    "headcount" integer,
    "date_added" "date",
    "repreneur_visibility" "public"."opportunity_visibility" DEFAULT 'anonymized'::"public"."opportunity_visibility" NOT NULL,
    "public_title" "text",
    "anonymized_description" "text",
    "staff_notes" "text",
    "imported_from" "text",
    "imported_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "headcount_range" "text",
    "repreneur_exposure" "public"."opportunity_visibility" DEFAULT 'anonymized'::"public"."opportunity_visibility" NOT NULL,
    "teaser_summary" "text",
    "internal_notes" "text",
    "source_office_id" "uuid",
    "updated_by" "text",
    "date_added_precision" "text",
    "geography_node_id" "uuid",
    CONSTRAINT "opportunities_active_or_paused_requires_source_office" CHECK ((("status" <> ALL (ARRAY['active'::"public"."opportunity_status", 'paused'::"public"."opportunity_status"])) OR ("source_office_id" IS NOT NULL))),
    CONSTRAINT "opportunities_date_added_precision_valid" CHECK ((("date_added_precision" IS NULL) OR ("date_added_precision" = ANY (ARRAY['day'::"text", 'month'::"text"]))))
);


--
-- Name: assign_acme_provisional_source("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assign_acme_provisional_source"("p_opportunity_id" "uuid", "p_actor" "text", "p_reason" "text") RETURNS "public"."opportunities"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  actor TEXT;
  reason TEXT;
  prior_source_snapshot JSONB;
  prior_contact_snapshot JSONB;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  reason := NULLIF(BTRIM(p_reason), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_actor_required';
  END IF;
  IF reason IS NULL OR CHAR_LENGTH(reason) > 4096 THEN
    RAISE EXCEPTION 'ma_provisional_source_reason_required';
  END IF;

  -- A shared transaction lock makes Acme assignment and cutover readiness
  -- mutually exclusive. Approved/activating runs block a new assignment, while
  -- activated historical runs do not permanently disable ordinary Acme use.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ma-provisional-source-cutover-readiness', 76064)
  );
  PERFORM public.assert_ma_provisional_source_context_integrity();

  IF EXISTS (
    SELECT 1
    FROM public.ma_cutover_runs run
    WHERE run.status IN ('approved', 'activating')
  ) THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_blocked_by_cutover';
  END IF;

  -- Preserve the existing office-context lock order after the readiness lock:
  -- opportunity, selected office, firm, affiliations, then current links.
  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;

  DELETE FROM public.ma_source_email_send_reservations reservation
  WHERE reservation.opportunity_id = opportunity_row.id
    AND reservation.expires_at <= NOW();
  IF EXISTS (
    SELECT 1
    FROM public.ma_source_email_send_reservations reservation
    WHERE reservation.opportunity_id = opportunity_row.id
      AND reservation.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'ma_provisional_source_change_blocked_during_email_send';
  END IF;

  IF opportunity_row.status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_supports_draft_active_or_paused_only';
  END IF;
  IF public.ma_opportunity_source_review_required(opportunity_row.id) THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_requires_resolution_first';
  END IF;

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF context_row.context_key IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_context_missing';
  END IF;

  prior_source_snapshot := public.ma_opportunity_source_snapshot(opportunity_row.id);
  prior_contact_snapshot := public.ma_opportunity_contact_snapshot(opportunity_row.id);

  saved_opportunity := public.save_opportunity_office_context(
    opportunity_row.id,
    context_row.office_id,
    ARRAY[context_row.affiliation_id],
    context_row.affiliation_id,
    NULL,
    opportunity_row.status,
    actor,
    '{}'::JSONB
  );

  INSERT INTO public.ma_provisional_source_review_events (
    opportunity_id,
    provisional_office_id,
    event_kind,
    prior_source_office_id,
    resulting_source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    resulting_source_snapshot,
    resulting_contact_snapshot,
    actor,
    reason
  ) VALUES (
    opportunity_row.id,
    context_row.office_id,
    'assigned',
    opportunity_row.source_office_id,
    saved_opportunity.source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    public.ma_opportunity_source_snapshot(saved_opportunity.id),
    public.ma_opportunity_contact_snapshot(saved_opportunity.id),
    actor,
    reason
  );

  RETURN saved_opportunity;
END;
$$;


--
-- Name: assign_repreneur_offer("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assign_repreneur_offer"("p_repreneur_id" "uuid", "p_offer_id" "uuid", "p_created_by" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_repreneur_id::text || ':' || p_offer_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.offers WHERE id = p_offer_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'This offer is no longer active. Refresh before assigning it.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repreneur_offers
    WHERE repreneur_id = p_repreneur_id
      AND offer_id = p_offer_id
      AND status IN ('offered', 'accepted')
  ) THEN
    RAISE EXCEPTION 'This offer already has an open assignment for this repreneur.';
  END IF;

  INSERT INTO public.repreneur_offers (repreneur_id, offer_id, status, offered_at, created_by)
  VALUES (p_repreneur_id, p_offer_id, 'offered', NOW(), p_created_by)
  RETURNING id INTO v_assignment_id;

  UPDATE public.repreneurs
  SET lifecycle_status = 'qualified'
  WHERE id = p_repreneur_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repreneur was not found.';
  END IF;

  RETURN v_assignment_id;
END;
$$;


--
-- Name: authorize_ma_contact_email_send("uuid", "uuid", "public"."ma_contact_email_purpose", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."authorize_ma_contact_email_send"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose", "p_actor" "text", "p_operation_key" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
  allowed BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL OR p_operation_key IS NULL THEN
    RAISE EXCEPTION 'ma_contact_email_authorization_requires_actor_and_operation';
  END IF;

  SELECT *
  INTO contact_row
  FROM public.ma_contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_contact_email_authorization_contact_not_found';
  END IF;

  allowed := public.ma_contact_email_is_allowed(
    p_contact_id,
    p_opportunity_id,
    p_purpose
  );

  IF NOT allowed THEN
    IF contact_row.campaign_email_suppressed THEN
      RAISE EXCEPTION 'ma_contact_campaign_email_suppressed';
    END IF;
    RAISE EXCEPTION 'ma_contact_email_purpose_or_link_not_authorized';
  END IF;

  IF contact_row.campaign_email_suppressed THEN
    INSERT INTO public.ma_contact_email_policy_events (
      contact_id,
      event_type,
      purpose,
      opportunity_id,
      actor,
      reason,
      operation_key
    )
    VALUES (
      p_contact_id,
      'allowlisted_operational_send',
      p_purpose,
      p_opportunity_id,
      BTRIM(p_actor),
      'Allowlisted NDA request for an actively linked opportunity contact.',
      p_operation_key
    )
    ON CONFLICT (
      contact_id,
      opportunity_id,
      purpose,
      operation_key
    )
    WHERE event_type = 'allowlisted_operational_send'
    DO NOTHING;
  END IF;

  RETURN TRUE;
END
$$;


--
-- Name: begin_ma_interaction_email_send("uuid", "uuid", "uuid", "text", "text", "text", "text", "text", "uuid", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."begin_ma_interaction_email_send"("p_opportunity_id" "uuid", "p_office_id" "uuid", "p_affiliation_id" "uuid", "p_actor" "text", "p_template_key" "text", "p_recipient_email" "text", "p_title" "text", "p_body_markdown" "text", "p_client_operation_key" "uuid", "p_provider_request_fingerprint" "text", "p_reservation_token" "uuid") RETURNS TABLE("interaction_id" "uuid", "provider_idempotency_key" "text", "delivery_status" "text", "provider_message_id" "text", "delivery_error" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  normalized_actor TEXT;
  opportunity_row public.opportunities%ROWTYPE;
  affiliation_office_id UUID;
  interaction_row public.ma_interactions%ROWTYPE;
  new_interaction_id UUID;
  staff_count INTEGER;
BEGIN
  normalized_actor := NULLIF(BTRIM(p_actor), '');
  IF normalized_actor IS NULL
    OR NULLIF(BTRIM(p_template_key), '') IS NULL
    OR NULLIF(BTRIM(p_recipient_email), '') IS NULL
    OR NULLIF(BTRIM(p_title), '') IS NULL
    OR NULLIF(BTRIM(p_body_markdown), '') IS NULL
    OR p_client_operation_key IS NULL
    OR p_provider_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_complete_staff_evidence';
  END IF;

  SELECT COUNT(*) INTO staff_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff' AND role.user_id = normalized_actor;
  IF staff_count <> 1 THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_exact_staff_actor';
  END IF;

  SELECT * INTO opportunity_row
  FROM public.opportunities opportunity
  WHERE opportunity.id = p_opportunity_id
  FOR UPDATE;
  IF opportunity_row.id IS NULL
    OR opportunity_row.source_office_id IS DISTINCT FROM p_office_id THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_current_opportunity_office';
  END IF;

  SELECT affiliation.office_id INTO affiliation_office_id
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.id = p_affiliation_id
    AND affiliation.is_active
    AND affiliation.ended_at IS NULL;
  IF affiliation_office_id IS DISTINCT FROM p_office_id THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_same_office_affiliation';
  END IF;

  IF public.ma_opportunity_source_review_required(opportunity_row.id) THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_external_email';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_source_email_send_reservations reservation
    WHERE reservation.opportunity_id = opportunity_row.id
      AND reservation.reservation_token = p_reservation_token
      AND reservation.actor = normalized_actor
      AND reservation.source_office_id = p_office_id
      AND reservation.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_active_reservation';
  END IF;

  SELECT * INTO interaction_row
  FROM public.ma_interactions interaction
  WHERE interaction.client_operation_key = p_client_operation_key
    OR (
      interaction.opportunity_id = opportunity_row.id
      AND interaction.provider_request_fingerprint = p_provider_request_fingerprint
      AND (
        interaction.delivery_status = 'pending'
        OR (
          interaction.delivery_status = 'sent'
          AND interaction.created_at > NOW() - INTERVAL '23 hours'
        )
      )
    )
  ORDER BY
    (interaction.client_operation_key = p_client_operation_key) DESC,
    interaction.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF interaction_row.id IS NOT NULL THEN
    IF interaction_row.opportunity_id IS DISTINCT FROM opportunity_row.id
      OR interaction_row.office_id IS DISTINCT FROM p_office_id
      OR interaction_row.affiliation_id IS DISTINCT FROM p_affiliation_id
      OR interaction_row.owner_staff_user_id IS DISTINCT FROM normalized_actor
      OR interaction_row.created_by IS DISTINCT FROM normalized_actor
      OR interaction_row.template_key IS DISTINCT FROM BTRIM(p_template_key)
      OR interaction_row.recipient_email_snapshot IS DISTINCT FROM BTRIM(p_recipient_email)
      OR interaction_row.title IS DISTINCT FROM BTRIM(p_title)
      OR interaction_row.body_markdown IS DISTINCT FROM p_body_markdown
      OR interaction_row.provider_request_fingerprint IS DISTINCT FROM p_provider_request_fingerprint THEN
      RAISE EXCEPTION 'ma_interaction_email_replay_requires_exact_request';
    END IF;

    IF interaction_row.delivery_status = 'pending' THEN
      IF interaction_row.created_at <= NOW() - INTERVAL '23 hours' THEN
        RAISE EXCEPTION 'ma_interaction_email_replay_window_expired';
      END IF;

      INSERT INTO public.ma_interaction_delivery_events (
        interaction_id, event_kind, actor, provider_idempotency_key
      ) VALUES (
        interaction_row.id, 'pending', normalized_actor, interaction_row.provider_idempotency_key
      );
    END IF;

    RETURN QUERY
    SELECT
      interaction_row.id,
      interaction_row.provider_idempotency_key,
      interaction_row.delivery_status,
      interaction_row.provider_message_id,
      interaction_row.delivery_error;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ma_interactions interaction
    WHERE interaction.opportunity_id = opportunity_row.id
      AND interaction.delivery_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'ma_interaction_email_pending_delivery_requires_exact_replay';
  END IF;

  new_interaction_id := gen_random_uuid();
  INSERT INTO public.ma_interactions (
    id, office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
    owner_staff_user_id, owner_verification_state, owner_verified_by,
    owner_verified_at, title, template_key, recipient_email_snapshot,
    body_markdown, delivery_status, client_operation_key,
    provider_idempotency_key, provider_request_fingerprint, created_by
  ) VALUES (
    new_interaction_id, p_office_id, p_affiliation_id, opportunity_row.id, 'email', 'outbound', NOW(),
    normalized_actor, 'verified', normalized_actor, NOW(), BTRIM(p_title), BTRIM(p_template_key),
    BTRIM(p_recipient_email), p_body_markdown, 'pending', p_client_operation_key,
    new_interaction_id::TEXT, p_provider_request_fingerprint, normalized_actor
  ) RETURNING * INTO interaction_row;

  INSERT INTO public.ma_interaction_delivery_events (
    interaction_id, event_kind, actor, provider_idempotency_key
  ) VALUES (
    interaction_row.id, 'pending', normalized_actor, interaction_row.provider_idempotency_key
  );

  RETURN QUERY
  SELECT
    interaction_row.id,
    interaction_row.provider_idempotency_key,
    interaction_row.delivery_status,
    interaction_row.provider_message_id,
    interaction_row.delivery_error;
END;
$_$;


--
-- Name: capture_opportunity_ma_contact_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."capture_opportunity_ma_contact_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
BEGIN
  SELECT contact.*
  INTO contact_row
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.id = NEW.affiliation_id;

  IF contact_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_not_found';
  END IF;

  NEW.contact_name_snapshot := COALESCE(
    NEW.contact_name_snapshot,
    contact_row.display_name
  );
  NEW.contact_email_snapshot := COALESCE(
    NEW.contact_email_snapshot,
    contact_row.email
  );
  NEW.contact_phone_snapshot := COALESCE(
    NEW.contact_phone_snapshot,
    contact_row.phone
  );
  RETURN NEW;
END;
$$;


--
-- Name: capture_opportunity_source_contact_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."capture_opportunity_source_contact_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  contact_row public.ma_source_contacts%ROWTYPE;
BEGIN
  SELECT *
  INTO contact_row
  FROM public.ma_source_contacts
  WHERE id = NEW.contact_id;

  IF contact_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_source_contact_not_found';
  END IF;

  NEW.contact_name_snapshot := COALESCE(NEW.contact_name_snapshot, contact_row.name);
  NEW.contact_email_snapshot := COALESCE(NEW.contact_email_snapshot, contact_row.email);
  NEW.contact_phone_snapshot := COALESCE(NEW.contact_phone_snapshot, contact_row.phone);
  RETURN NEW;
END;
$$;


--
-- Name: claim_notification_delivery("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."claim_notification_delivery"("p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  normalized_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
  existing public.notification_delivery_claims%ROWTYPE;
  claimed_at TIMESTAMPTZ := clock_timestamp();
  next_lease_token UUID := gen_random_uuid();
BEGIN
  IF normalized_key IS NULL OR LENGTH(normalized_key) > 256 THEN
    RAISE EXCEPTION 'A valid notification idempotency key is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_key, 0));

  SELECT * INTO existing
  FROM public.notification_delivery_claims
  WHERE idempotency_key = normalized_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.notification_delivery_claims (
      idempotency_key, status, lease_expires_at, lease_token, attempt_count, updated_at
    ) VALUES (
      normalized_key,
      'pending',
      claimed_at + INTERVAL '5 minutes',
      next_lease_token,
      1,
      claimed_at
    );
    RETURN jsonb_build_object('status', 'claimed', 'leaseToken', next_lease_token::TEXT);
  END IF;

  IF existing.status = 'sent' THEN
    RETURN jsonb_build_object('status', 'sent');
  END IF;

  IF existing.status = 'pending' AND existing.lease_expires_at > claimed_at THEN
    RETURN jsonb_build_object('status', 'busy');
  END IF;

  UPDATE public.notification_delivery_claims
  SET status = 'pending',
      lease_expires_at = claimed_at + INTERVAL '5 minutes',
      lease_token = next_lease_token,
      attempt_count = attempt_count + 1,
      updated_at = claimed_at
  WHERE idempotency_key = normalized_key;

  RETURN jsonb_build_object('status', 'claimed', 'leaseToken', next_lease_token::TEXT);
END;
$$;


--
-- Name: claim_opportunity_memo_notification("uuid", "uuid", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."claim_opportunity_memo_notification"("p_opportunity_id" "uuid", "p_match_id" "uuid" DEFAULT NULL::"uuid", "p_attempted_at" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("match_id" "uuid", "opportunity_id" "uuid", "repreneur_id" "uuid", "recipient_email" "text", "repreneur_first_name" "text", "opportunity_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v public.opportunity_matches%ROWTYPE; v_email TEXT; v_first TEXT; v_title TEXT; v_claim UUID;
BEGIN
 SELECT m.* INTO v FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id JOIN public.repreneurs r ON r.id=m.repreneur_id LEFT JOIN public.opportunity_memo_notifications n ON n.match_id=m.id
 WHERE m.opportunity_id=p_opportunity_id AND (p_match_id IS NULL OR m.id=p_match_id) AND m.status='active_pursuit' AND o.status='active' AND g.revoked_at IS NULL AND g.nda_expires_at>p_attempted_at
 AND g.cycle_started_evidence_id=public.journey_current_cycle_event(m.id) AND g.gate_2_evidence_id=public.journey_current_gate_2_event(m.id) AND g.dispatch_evidence_id=public.journey_current_dispatch_event(m.id)
 AND NULLIF(BTRIM(r.email),'') IS NOT NULL AND (n.match_id IS NULL OR (n.sent_at IS NULL AND (n.status IN ('pending','failed') OR (n.status='sending' AND n.last_attempt_at<p_attempted_at-INTERVAL '15 minutes')))) ORDER BY m.updated_at DESC LIMIT 1 FOR UPDATE OF m;
 IF v.id IS NULL THEN RETURN; END IF;
 SELECT BTRIM(email),COALESCE(NULLIF(BTRIM(first_name),''),'Madame, Monsieur') INTO v_email,v_first FROM public.repreneurs WHERE id=v.repreneur_id; SELECT COALESCE(NULLIF(BTRIM(public_title),''),'votre opportunite') INTO v_title FROM public.opportunities WHERE id=v.opportunity_id;
 INSERT INTO public.opportunity_memo_notifications(match_id,opportunity_id,repreneur_id,recipient_email) VALUES(v.id,v.opportunity_id,v.repreneur_id,v_email) ON CONFLICT ON CONSTRAINT opportunity_memo_notifications_match_id_key DO UPDATE SET recipient_email=EXCLUDED.recipient_email,updated_at=p_attempted_at WHERE opportunity_memo_notifications.sent_at IS NULL;
 UPDATE public.opportunity_memo_notifications n SET status='sending',attempt_count=n.attempt_count+1,last_attempt_at=p_attempted_at,failed_at=NULL,last_error=NULL,updated_at=p_attempted_at WHERE n.match_id=v.id AND n.sent_at IS NULL AND (n.status IN ('pending','failed') OR (n.status='sending' AND n.last_attempt_at<p_attempted_at-INTERVAL '15 minutes')) RETURNING n.match_id INTO v_claim;
 IF v_claim IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT v.id,v.opportunity_id,v.repreneur_id,v_email,v_first,v_title;
END $$;


--
-- Name: clear_external_pursuit_attachment_records_for_fulfillment("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."clear_external_pursuit_attachment_records_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE;
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, TRUE);
  IF p.deletion_status <> 'delete_requested' THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
  DELETE FROM public.external_pursuit_attachments WHERE external_pursuit_id=p_dossier_id;
END $$;


--
-- Name: close_opportunity_with_reason("uuid", "public"."opportunity_closure_reason", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."close_opportunity_with_reason"("p_opportunity_id" "uuid", "p_reason" "public"."opportunity_closure_reason", "p_closed_by" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_opportunity_id UUID;
BEGIN
  IF p_closed_by IS NULL OR BTRIM(p_closed_by) = '' THEN
    RAISE EXCEPTION 'closure_actor_required';
  END IF;

  UPDATE public.opportunities
  SET status = 'closed'::public.opportunity_status
  WHERE id = p_opportunity_id
    AND status <> 'closed'::public.opportunity_status
  RETURNING id INTO v_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'opportunity_not_open_for_closure';
  END IF;

  INSERT INTO public.opportunity_closure_history (
    opportunity_id,
    reason,
    closed_by
  )
  VALUES (
    v_opportunity_id,
    p_reason,
    p_closed_by
  );
END;
$$;


--
-- Name: complete_notification_delivery("text", "text", boolean, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."complete_notification_delivery"("p_idempotency_key" "text", "p_lease_token" "text", "p_succeeded" boolean, "p_provider_message_id" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  normalized_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
  normalized_lease_token TEXT := NULLIF(BTRIM(p_lease_token), '');
  completed_at TIMESTAMPTZ := clock_timestamp();
  existing public.notification_delivery_claims%ROWTYPE;
BEGIN
  IF normalized_key IS NULL OR normalized_lease_token IS NULL THEN
    RAISE EXCEPTION 'A notification idempotency key and lease token are required.';
  END IF;

  SELECT * INTO existing
  FROM public.notification_delivery_claims
  WHERE idempotency_key = normalized_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification delivery claim was not found.';
  END IF;

  -- Sent is terminal. In particular, an expired older worker cannot report a
  -- late failure and downgrade a newer worker's conclusive success.
  IF existing.status = 'sent' THEN
    RETURN 'sent';
  END IF;

  IF existing.status <> 'pending'
    OR existing.lease_token::TEXT IS DISTINCT FROM normalized_lease_token
  THEN
    RETURN 'stale';
  END IF;

  UPDATE public.notification_delivery_claims
  SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
      lease_expires_at = NULL,
      lease_token = NULL,
      provider_message_id = CASE WHEN p_succeeded THEN p_provider_message_id ELSE NULL END,
      sent_at = CASE WHEN p_succeeded THEN completed_at ELSE NULL END,
      updated_at = completed_at
  WHERE idempotency_key = normalized_key;

  RETURN CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END;
END;
$$;


--
-- Name: complete_opportunity_memo_notification("uuid", timestamp with time zone, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."complete_opportunity_memo_notification"("p_match_id" "uuid", "p_sent_at" timestamp with time zone DEFAULT "now"(), "p_provider_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.opportunity_memo_notifications
  SET
    status = 'sent',
    provider_id = COALESCE(provider_id, p_provider_id),
    sent_at = COALESCE(sent_at, p_sent_at),
    failed_at = NULL,
    last_error = NULL,
    updated_at = p_sent_at
  WHERE match_id = p_match_id;
END;
$$;


--
-- Name: compute_journey_stage(integer, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."compute_journey_stage"("milestone_count" integer, "persona" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF milestone_count >= 18 THEN
    RETURN 'post_acquisition';
  ELSIF milestone_count >= 16 THEN
    RETURN 'execution';
  ELSIF milestone_count >= 9 THEN
    RETURN 'ready';
  ELSIF milestone_count >= 2 THEN
    RETURN 'learner';
  ELSE
    RETURN 'explorer';
  END IF;
END;
$$;


--
-- Name: compute_ma_cutover_approval_digest("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."compute_ma_cutover_approval_digest"("p_run_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  manifest JSONB;
  staged_rows JSONB;
  staged_issues JSONB;
  digest_input JSONB;
BEGIN
  SELECT JSONB_BUILD_OBJECT(
    'run_id', run.id,
    'source_fingerprint', run.source_fingerprint,
    'source_hash', run.source_hash,
    'reconciliation_summary', run.reconciliation_summary,
    'review_decisions', run.review_decisions
  )
  INTO manifest
  FROM public.ma_cutover_runs run
  WHERE run.id = p_run_id;

  IF manifest IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_not_found';
  END IF;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', row.id,
        'entity_kind', row.entity_kind,
        'resolution_action', row.resolution_action,
        'reuse_canonical_id', row.reuse_canonical_id,
        'temporary_entity_id', row.temporary_entity_id,
        'parent_temporary_entity_id', row.parent_temporary_entity_id,
        'related_temporary_entity_ids', row.related_temporary_entity_ids,
        'source_row_locator', row.source_row_locator,
        'normalized_payload', row.normalized_payload
      )
      ORDER BY row.entity_kind, row.temporary_entity_id, row.id
    ),
    '[]'::JSONB
  )
  INTO staged_rows
  FROM public.ma_cutover_stage_rows row
  WHERE row.run_id = p_run_id;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', issue.id,
        'stage_row_id', issue.stage_row_id,
        'severity', issue.severity,
        'code', issue.code,
        'field_name', issue.field_name,
        'message', issue.message,
        'resolution_note', issue.resolution_note,
        'resolved_by', issue.resolved_by,
        -- A timestamptz-to-JSON conversion is session-TimeZone dependent.
        -- Canonical epoch microseconds keep the digest stable across sessions.
        'resolved_at_epoch_us', CASE
          WHEN issue.resolved_at IS NULL THEN NULL
          ELSE (EXTRACT(EPOCH FROM issue.resolved_at) * 1000000)::BIGINT
        END
      )
      ORDER BY
        COALESCE(issue.stage_row_id::TEXT, ''),
        issue.severity,
        issue.code,
        COALESCE(issue.field_name, ''),
        issue.id
    ),
    '[]'::JSONB
  )
  INTO staged_issues
  FROM public.ma_cutover_stage_issues issue
  WHERE issue.run_id = p_run_id;

  digest_input := JSONB_BUILD_OBJECT(
    'version', 'ma-cutover-approval-digest-v1',
    'manifest', manifest,
    'stage_rows', staged_rows,
    'stage_issues', staged_issues
  );

  RETURN pg_catalog.encode(
    extensions.digest(digest_input::TEXT, 'sha256'),
    'hex'
  );
END;
$$;


--
-- Name: confirm_external_pursuit_current("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."confirm_external_pursuit_current"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  dossier public.external_pursuits%ROWTYPE;
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'An actor and idempotency key are required.';
  END IF;

  -- Migration 099 must follow the corrected migration 098. This is the same
  -- dossier lock used by edit, deletion and conversion, so confirmation can
  -- never race a terminal or converted-state transition.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));
  IF EXISTS (
    SELECT 1
    FROM public.external_pursuit_audit_events event
    WHERE event.external_pursuit_id = p_dossier_id
      AND event.event_type = 'updated'
      AND event.actor_user_id = actor
      AND event.idempotency_key = p_idempotency_key
      AND event.metadata->>'confirmation' = 'current'
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.external_pursuit_audit_events event
    WHERE event.external_pursuit_id = p_dossier_id
      AND event.event_type = 'updated'
      AND event.actor_user_id = actor
      AND event.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'External Pursuit confirmation idempotency conflict.';
  END IF;

  -- Staff may confirm any authorised dossier; a repreneur is restricted by
  -- this shared assertion to their own active dossier.
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF dossier.deletion_status <> 'active'
     OR dossier.stage IN ('completed', 'dropped_archived')
     OR EXISTS (
       SELECT 1
       FROM public.external_pursuit_opportunity_conversions conversion
       WHERE conversion.external_pursuit_id = dossier.id
     ) THEN
    RAISE EXCEPTION 'External Pursuit is not open capacity.';
  END IF;

  UPDATE public.external_pursuits
  SET last_confirmed_at = clock_timestamp(),
      last_confirmed_by = actor,
      updated_at = clock_timestamp(),
      updated_by = actor
  WHERE id = dossier.id;

  PERFORM public.external_pursuit_append_audit(
    dossier.id,
    'updated',
    actor,
    p_idempotency_key,
    jsonb_build_object('confirmation', 'current')
  );
END;
$$;


--
-- Name: convert_external_pursuit_to_opportunity("uuid", "text", "uuid", "uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."convert_external_pursuit_to_opportunity"("p_dossier_id" "uuid", "p_public_title" "text", "p_geography_node_id" "uuid", "p_source_office_id" "uuid", "p_primary_affiliation_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS TABLE("opportunity_id" "uuid", "opportunity_reference" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  actor_role public.app_user_role;
  dossier public.external_pursuits%ROWTYPE;
  existing public.external_pursuit_opportunity_conversions%ROWTYPE;
  source_office public.ma_offices%ROWTYPE;
  node public.geography_nodes%ROWTYPE;
  saved public.opportunities%ROWTYPE;
  safe_title TEXT := NULLIF(BTRIM(p_public_title), '');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'external_pursuit_conversion_actor_and_key_required';
  END IF;
  IF p_dossier_id IS NULL OR p_geography_node_id IS NULL
     OR p_source_office_id IS NULL OR p_primary_affiliation_id IS NULL
     OR safe_title IS NULL THEN
    RAISE EXCEPTION 'external_pursuit_conversion_fields_required';
  END IF;
  IF char_length(safe_title) > 240 THEN
    RAISE EXCEPTION 'external_pursuit_conversion_public_title_too_long';
  END IF;

  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;

  -- Use the exact dossier lock already owned by update and deletion. This
  -- makes conversion, edit and delete mutually exclusive before either a
  -- mandate number or an opportunity row can be allocated.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));

  SELECT * INTO existing
  FROM public.external_pursuit_opportunity_conversions
  WHERE external_pursuit_id = p_dossier_id;
  IF FOUND THEN
    IF existing.converted_by = actor
       AND existing.idempotency_key = p_idempotency_key THEN
      RETURN QUERY
      SELECT existing.opportunity_id, opportunity.reference
      FROM public.opportunities opportunity
      WHERE opportunity.id = existing.opportunity_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'external_pursuit_already_converted';
  END IF;

  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, TRUE);
  IF dossier.deletion_status <> 'active'
     OR dossier.stage IN ('completed', 'dropped_archived') THEN
    RAISE EXCEPTION 'external_pursuit_conversion_requires_active_dossier';
  END IF;

  SELECT * INTO source_office
  FROM public.ma_offices
  WHERE id = p_source_office_id;
  IF source_office.id IS NULL OR source_office.status <> 'active'
     OR source_office.is_default
     OR NOT EXISTS (
       SELECT 1 FROM public.ma_firms firm
       WHERE firm.id = source_office.firm_id AND firm.status = 'active'
     ) THEN
    RAISE EXCEPTION 'external_pursuit_conversion_requires_active_real_office';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ma_provisional_source_contexts provisional
    WHERE provisional.context_key = 'acme_co_paris'
      AND provisional.office_id = source_office.id
  ) THEN
    RAISE EXCEPTION 'external_pursuit_conversion_rejects_acme_source';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_contact_office_affiliations affiliation
    JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
    WHERE affiliation.id = p_primary_affiliation_id
      AND affiliation.office_id = source_office.id
      AND affiliation.is_active
      AND contact.status = 'active'
      AND NULLIF(BTRIM(contact.display_name), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'external_pursuit_conversion_requires_active_named_primary_contact';
  END IF;

  -- W-039 owns the canonical geography validation. Passing it to the existing
  -- creation RPC also allocates the immutable reference in this transaction.
  node := public.resolve_w039_geography_node(p_geography_node_id::TEXT);
  saved := public.create_opportunity_with_office_context(
    '',
    source_office.id,
    ARRAY[p_primary_affiliation_id],
    p_primary_affiliation_id,
    NULL,
    'draft',
    actor,
    jsonb_build_object(
      'geography_node_id', node.id,
      'public_title', safe_title
    )
  );

  INSERT INTO public.external_pursuit_opportunity_conversions (
    external_pursuit_id,
    opportunity_id,
    converted_by,
    idempotency_key
  ) VALUES (
    dossier.id,
    saved.id,
    actor,
    p_idempotency_key
  );

  RETURN QUERY SELECT saved.id, saved.reference;
END;
$$;


--
-- Name: create_external_pursuit("uuid", "text", "text", "text", "date", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_external_pursuit"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE actor_role public.app_user_role; actor_owner UUID; id UUID; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  SELECT role, repreneur_id INTO actor_role, actor_owner FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS NULL OR (actor_role <> 'staff' AND (actor_role <> 'repreneur' OR actor_owner <> p_owner_repreneur_id)) THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'A title and idempotency key are required.'; END IF;
  IF actor_role <> 'staff' AND NULLIF(BTRIM(p_staff_internal_notes), '') IS NOT NULL THEN RAISE EXCEPTION 'Only staff may set internal notes.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor || ':' || p_owner_repreneur_id::text || ':' || p_idempotency_key, 0));
  SELECT ep.id INTO id FROM public.external_pursuits ep WHERE ep.created_by=actor AND ep.owner_repreneur_id=p_owner_repreneur_id AND ep.create_idempotency_key = p_idempotency_key;
  IF id IS NOT NULL THEN RETURN id; END IF;
  INSERT INTO public.external_pursuits (owner_repreneur_id,title,stage,availability,due_at,create_idempotency_key,created_by,updated_by)
  VALUES (p_owner_repreneur_id,BTRIM(p_title),COALESCE(NULLIF(BTRIM(p_stage), ''),'identified')::public.external_pursuit_stage,COALESCE(NULLIF(BTRIM(p_availability), ''),'unknown')::public.external_pursuit_availability,p_due_at,p_idempotency_key,actor,actor)
  ON CONFLICT (created_by,owner_repreneur_id,create_idempotency_key) DO NOTHING RETURNING external_pursuits.id INTO id;
  IF id IS NULL THEN SELECT ep.id INTO id FROM public.external_pursuits ep WHERE ep.created_by=actor AND ep.owner_repreneur_id=p_owner_repreneur_id AND ep.create_idempotency_key=p_idempotency_key; RETURN id; END IF;
  INSERT INTO public.external_pursuit_notes (external_pursuit_id,shared_notes,updated_by) VALUES (id,NULLIF(BTRIM(p_shared_notes),''),actor);
  IF actor_role = 'staff' THEN INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id,staff_internal_notes,updated_by) VALUES (id,NULLIF(BTRIM(p_staff_internal_notes),''),actor); END IF;
  PERFORM public.external_pursuit_append_audit(id,'created',actor,p_idempotency_key,jsonb_build_object('owner_repreneur_id',p_owner_repreneur_id));
  RETURN id;
END $$;


--
-- Name: create_external_pursuit_v2("uuid", "text", "text", "text", "date", "text", "text", "text", "text", "text", numeric, numeric, integer, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_external_pursuit_v2"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_external_url" "text", "p_target_company" "text", "p_source_channel" "text", "p_revenue_meur" numeric, "p_ebitda_keur" numeric, "p_headcount" integer, "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role; actor_owner UUID; v_dossier_id UUID;
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'External Pursuit title and idempotency key are required.';
  END IF;
  SELECT role, repreneur_id INTO actor_role, actor_owner FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS NULL OR (actor_role = 'repreneur' AND actor_owner <> p_owner_repreneur_id) THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor || ':' || p_owner_repreneur_id::text || ':' || p_idempotency_key, 0));
  SELECT ep.id INTO v_dossier_id FROM public.external_pursuits ep
    WHERE ep.created_by = actor AND ep.owner_repreneur_id = p_owner_repreneur_id AND ep.create_idempotency_key = p_idempotency_key;
  IF v_dossier_id IS NOT NULL THEN RETURN v_dossier_id; END IF;
  INSERT INTO public.external_pursuits AS inserted_dossier (
    owner_repreneur_id, title, stage, availability, due_at, external_url, target_company, source_channel,
    revenue_meur, ebitda_keur, headcount, create_idempotency_key, created_by, updated_by
  ) VALUES (
    p_owner_repreneur_id, BTRIM(p_title), COALESCE(NULLIF(BTRIM(p_stage), ''), 'identified')::public.external_pursuit_stage,
    COALESCE(NULLIF(BTRIM(p_availability), ''), 'unknown')::public.external_pursuit_availability, p_due_at,
    NULLIF(BTRIM(p_external_url), ''), NULLIF(BTRIM(p_target_company), ''), NULLIF(BTRIM(p_source_channel), ''),
    p_revenue_meur, p_ebitda_keur, p_headcount, p_idempotency_key, actor, actor
  ) ON CONFLICT (created_by, owner_repreneur_id, create_idempotency_key) DO NOTHING
    RETURNING inserted_dossier.id INTO v_dossier_id;
  IF v_dossier_id IS NULL THEN
    SELECT ep.id INTO v_dossier_id FROM public.external_pursuits ep
      WHERE ep.created_by = actor AND ep.owner_repreneur_id = p_owner_repreneur_id AND ep.create_idempotency_key = p_idempotency_key;
    RETURN v_dossier_id;
  END IF;
  INSERT INTO public.external_pursuit_notes (external_pursuit_id, shared_notes, updated_by)
    VALUES (v_dossier_id, NULLIF(BTRIM(p_shared_notes), ''), actor);
  IF actor_role = 'staff' THEN
    INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id, staff_internal_notes, updated_by)
      VALUES (v_dossier_id, NULLIF(BTRIM(p_staff_internal_notes), ''), actor);
  END IF;
  PERFORM public.external_pursuit_append_audit(v_dossier_id, 'created', actor, p_idempotency_key,
    jsonb_build_object('owner_repreneur_id', p_owner_repreneur_id));
  RETURN v_dossier_id;
END $$;


--
-- Name: create_ma_firm_with_default_office("text", "text", "text", "text", boolean, "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_ma_firm_with_default_office"("p_firm_name" "text", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_office_name" "text" DEFAULT NULL::"text", "p_is_synthetic_default" boolean DEFAULT NULL::boolean, "p_contact_email" "text" DEFAULT NULL::"text", "p_contact_phone" "text" DEFAULT NULL::"text", "p_contact_job_title" "text" DEFAULT NULL::"text", "p_actor" "text" DEFAULT NULL::"text") RETURNS TABLE("firm_id" "uuid", "office_id" "uuid", "contact_id" "uuid", "affiliation_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  actor TEXT;
  firm_name TEXT;
  normalized_firm_name TEXT;
  office_name TEXT;
  contact_first_name TEXT;
  contact_last_name TEXT;
  use_synthetic_default BOOLEAN;
  created_firm_id UUID;
  created_office_id UUID;
  created_contact_id UUID;
  created_affiliation_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  firm_name := NULLIF(BTRIM(p_firm_name), '');
  office_name := NULLIF(BTRIM(p_office_name), '');
  contact_first_name := NULLIF(BTRIM(p_contact_first_name), '');
  contact_last_name := NULLIF(BTRIM(p_contact_last_name), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;

  IF firm_name IS NULL THEN
    RAISE EXCEPTION 'ma_firm_name_required';
  END IF;

  -- Serialize canonical firm creation by the normalized business name. This
  -- prevents two concurrent intake requests from passing the exact-match
  -- check before either inserts a case or whitespace variant.
  normalized_firm_name := LOWER(BTRIM(firm_name));
  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_firm_name, 76061));

  IF EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    WHERE LOWER(BTRIM(firm.name)) = normalized_firm_name
  ) THEN
    RAISE EXCEPTION 'ma_firm_name_already_exists';
  END IF;

  IF contact_first_name IS NULL AND contact_last_name IS NULL THEN
    RAISE EXCEPTION 'ma_contact_requires_name_component';
  END IF;

  -- Safe default: a missing office means the branch is genuinely unknown;
  -- a supplied office name is real unless staff explicitly says otherwise.
  use_synthetic_default := COALESCE(p_is_synthetic_default, office_name IS NULL);
  IF use_synthetic_default THEN
    IF office_name IS NOT NULL AND office_name <> firm_name THEN
      RAISE EXCEPTION 'ma_synthetic_default_office_must_use_firm_name';
    END IF;

    office_name := firm_name;
  ELSIF office_name IS NULL THEN
    RAISE EXCEPTION 'ma_real_office_name_required';
  END IF;

  INSERT INTO public.ma_firms (
    name,
    created_by,
    updated_by
  ) VALUES (
    firm_name,
    actor,
    actor
  )
  RETURNING id INTO created_firm_id;

  INSERT INTO public.ma_offices (
    firm_id,
    name,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    created_firm_id,
    office_name,
    use_synthetic_default,
    actor,
    actor
  )
  RETURNING id INTO created_office_id;

  INSERT INTO public.ma_contacts (
    first_name,
    last_name,
    email,
    phone,
    created_by,
    updated_by
  ) VALUES (
    contact_first_name,
    contact_last_name,
    NULLIF(BTRIM(p_contact_email), ''),
    NULLIF(BTRIM(p_contact_phone), ''),
    actor,
    actor
  )
  RETURNING id INTO created_contact_id;

  INSERT INTO public.ma_contact_office_affiliations (
    contact_id,
    office_id,
    job_title,
    created_by
  ) VALUES (
    created_contact_id,
    created_office_id,
    NULLIF(BTRIM(p_contact_job_title), ''),
    actor
  )
  RETURNING id INTO created_affiliation_id;

  RETURN QUERY
  SELECT
    created_firm_id,
    created_office_id,
    created_contact_id,
    created_affiliation_id;
END;
$$;


--
-- Name: create_ma_office_for_existing_firm("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_ma_office_for_existing_firm"("p_firm_id" "uuid", "p_office_name" "text", "p_actor" "text" DEFAULT NULL::"text") RETURNS TABLE("firm_id" "uuid", "firm_name" "text", "office_id" "uuid", "office_name" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  actor TEXT;
  office_name_value TEXT;
  normalized_office_name TEXT;
  firm_row public.ma_firms%ROWTYPE;
  created_office_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  office_name_value := NULLIF(BTRIM(p_office_name), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;
  IF p_firm_id IS NULL THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF office_name_value IS NULL THEN
    RAISE EXCEPTION 'ma_real_office_name_required';
  END IF;

  -- Serialize all real-office additions for this firm/name pair before the
  -- duplicate check. The partial unique index remains the final guard.
  normalized_office_name := LOWER(BTRIM(office_name_value));
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_firm_id::TEXT || ':' || normalized_office_name, 76082)
  );

  SELECT * INTO firm_row
  FROM public.ma_firms
  WHERE id = p_firm_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF firm_row.status <> 'active' THEN
    RAISE EXCEPTION 'ma_existing_firm_not_active';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ma_offices office
    WHERE office.firm_id = firm_row.id
      AND office.status = 'active'
      AND NOT office.is_default
      AND LOWER(BTRIM(office.name)) = normalized_office_name
  ) THEN
    RAISE EXCEPTION 'ma_real_office_name_already_exists';
  END IF;

  INSERT INTO public.ma_offices (
    firm_id,
    name,
    status,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    firm_row.id,
    office_name_value,
    'active',
    FALSE,
    actor,
    actor
  )
  RETURNING id INTO created_office_id;

  -- A synthetic default remains immutable historical attribution. The intake
  -- projection already removes it once this real office exists.
  RETURN QUERY
  SELECT firm_row.id, firm_row.name, created_office_id, office_name_value;
END;
$$;


--
-- Name: create_ma_relationship_interaction("uuid", "uuid", "uuid", "text", "text", timestamp with time zone, "text", "text", "text", "text", timestamp with time zone, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_ma_relationship_interaction"("p_office_id" "uuid", "p_affiliation_id" "uuid", "p_opportunity_id" "uuid", "p_channel" "text", "p_direction" "text", "p_occurred_at" timestamp with time zone, "p_title" "text", "p_summary" "text", "p_outcome" "text", "p_next_action" "text", "p_next_action_due_at" timestamp with time zone, "p_recipient_email_snapshot" "text", "p_actor" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  normalized_actor TEXT;
  normalized_channel TEXT;
  normalized_direction TEXT;
  normalized_summary TEXT;
  normalized_recipient_email TEXT;
  affiliation_office_id UUID;
  opportunity_office_id UUID;
  new_interaction_id UUID;
BEGIN
  normalized_actor := NULLIF(BTRIM(p_actor), '');
  normalized_channel := LOWER(NULLIF(BTRIM(p_channel), ''));
  normalized_direction := LOWER(NULLIF(BTRIM(p_direction), ''));
  normalized_summary := NULLIF(BTRIM(p_summary), '');
  normalized_recipient_email := NULLIF(LOWER(BTRIM(p_recipient_email_snapshot)), '');

  IF normalized_actor IS NULL
    OR p_office_id IS NULL
    OR normalized_channel NOT IN ('call', 'email', 'meeting', 'document', 'other')
    OR p_occurred_at IS NULL
    OR normalized_summary IS NULL THEN
    RAISE EXCEPTION 'ma_relationship_interaction_requires_complete_staff_evidence';
  END IF;

  IF normalized_channel IN ('call', 'email')
    AND normalized_direction NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION 'ma_relationship_interaction_requires_direction';
  END IF;
  IF normalized_channel = 'email'
    AND normalized_direction = 'outbound'
    AND normalized_recipient_email IS NULL THEN
    RAISE EXCEPTION 'ma_relationship_interaction_outbound_email_requires_recipient';
  END IF;
  IF normalized_channel = 'email'
    AND normalized_direction = 'outbound'
    AND normalized_recipient_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'ma_relationship_interaction_outbound_email_requires_valid_recipient';
  END IF;
  IF normalized_channel NOT IN ('call', 'email')
    AND normalized_direction IS NOT NULL THEN
    RAISE EXCEPTION 'ma_relationship_interaction_direction_not_supported';
  END IF;
  IF normalized_channel <> 'email' OR normalized_direction <> 'outbound' THEN
    normalized_recipient_email := NULL;
  END IF;

  IF (SELECT COUNT(*) FROM public.app_user_roles role
      WHERE role.role = 'staff' AND role.user_id = normalized_actor) <> 1 THEN
    RAISE EXCEPTION 'ma_relationship_interaction_requires_exact_staff_actor';
  END IF;

  -- Source assignment and resolution take the opportunity row first, then
  -- validate their selected office/context. Take that same row lock before
  -- reading either office relationship or provisional-review state so one
  -- transaction cannot create immutable history from a stale source office.
  IF p_opportunity_id IS NOT NULL THEN
    SELECT opportunity.source_office_id INTO opportunity_office_id
    FROM public.opportunities opportunity
    WHERE opportunity.id = p_opportunity_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ma_relationship_interaction_opportunity_not_found';
    END IF;
    IF opportunity_office_id IS DISTINCT FROM p_office_id THEN
      RAISE EXCEPTION 'ma_relationship_interaction_opportunity_must_match_office';
    END IF;
    IF public.ma_opportunity_source_review_required(p_opportunity_id) THEN
      RAISE EXCEPTION 'ma_provisional_source_review_blocks_relationship_interaction';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ma_offices office WHERE office.id = p_office_id
  ) THEN
    RAISE EXCEPTION 'ma_relationship_interaction_office_not_found';
  END IF;

  IF p_affiliation_id IS NOT NULL THEN
    SELECT affiliation.office_id INTO affiliation_office_id
    FROM public.ma_contact_office_affiliations affiliation
    WHERE affiliation.id = p_affiliation_id
      AND affiliation.is_active
      AND affiliation.ended_at IS NULL;
    IF affiliation_office_id IS DISTINCT FROM p_office_id THEN
      RAISE EXCEPTION 'ma_relationship_interaction_affiliation_must_match_active_office';
    END IF;
  END IF;

  INSERT INTO public.ma_interactions (
    office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
    owner_staff_user_id, owner_verification_state, owner_verified_by,
    owner_verified_at, title, summary, outcome, next_action,
    next_action_due_at, recipient_email_snapshot, created_by, updated_by
  ) VALUES (
    p_office_id, p_affiliation_id, p_opportunity_id, normalized_channel,
    normalized_direction, p_occurred_at, normalized_actor, 'verified',
    normalized_actor, NOW(), NULLIF(BTRIM(p_title), ''), normalized_summary,
    NULLIF(BTRIM(p_outcome), ''), NULLIF(BTRIM(p_next_action), ''),
    p_next_action_due_at, normalized_recipient_email, normalized_actor, normalized_actor
  ) RETURNING id INTO new_interaction_id;

  RETURN new_interaction_id;
END;
$_$;


--
-- Name: create_opportunity_with_office_context("text", "uuid", "uuid"[], "uuid", "text", "public"."opportunity_status", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_opportunity_with_office_context"("p_reference" "text", "p_source_office_id" "uuid" DEFAULT NULL::"uuid", "p_affiliation_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_primary_affiliation_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_target_status" "public"."opportunity_status" DEFAULT 'draft'::"public"."opportunity_status", "p_actor" "text" DEFAULT NULL::"text", "p_opportunity_fields" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."opportunities"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE node public.geography_nodes%ROWTYPE; allocated BIGINT; initial_sequence BIGINT; generated_reference TEXT; saved public.opportunities%ROWTYPE; enforce_geography BOOLEAN;
BEGIN
  SELECT enforce_new_opportunity_geography INTO enforce_geography FROM public.ma_w039_release_control WHERE singleton;
  IF NOT enforce_geography AND NOT (p_opportunity_fields ? 'geography_node_id') THEN
    IF p_opportunity_fields ? 'date_added_confirm_day'
       AND JSONB_TYPEOF(p_opportunity_fields -> 'date_added_confirm_day') <> 'boolean' THEN
      RAISE EXCEPTION 'opportunity_date_added_confirmation_must_be_boolean';
    END IF;
    RETURN public.create_opportunity_with_office_context_legacy(p_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields - 'date_added_confirm_day');
  END IF;
  node := public.resolve_w039_geography_node(p_opportunity_fields ->> 'geography_node_id');
  -- Bootstrap each canonical code from its exact historic numeric suffix, not
  -- from a row count. Existing BFC history does not collide with new BFR.
  SELECT COALESCE(MAX((regexp_match(reference, '^Re-New - ' || node.code || ' - ([0-9]+)$', 'i'))[1]::BIGINT), 0) + 1
    INTO initial_sequence
    FROM public.opportunities
    WHERE reference ~* ('^Re-New - ' || node.code || ' - [0-9]+$');
  INSERT INTO public.opportunity_mandate_reference_counters(reference_code,next_sequence)
    VALUES (node.code, initial_sequence + 1)
    ON CONFLICT (reference_code) DO UPDATE SET next_sequence = public.opportunity_mandate_reference_counters.next_sequence + 1, updated_at = NOW()
    RETURNING next_sequence - 1 INTO allocated;
  generated_reference := format(
    'Re-New - %s - %s',
    node.code,
    CASE WHEN allocated < 1000 THEN LPAD(allocated::TEXT, 3, '0') ELSE allocated::TEXT END
  );
  -- p_reference is retained only for old callers; it is deliberately ignored.
  IF p_opportunity_fields ? 'date_added_confirm_day'
     AND JSONB_TYPEOF(p_opportunity_fields -> 'date_added_confirm_day') <> 'boolean' THEN
    RAISE EXCEPTION 'opportunity_date_added_confirmation_must_be_boolean';
  END IF;
  saved := public.create_opportunity_with_office_context_legacy(generated_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day']);
  UPDATE public.opportunities SET geography_node_id = node.id, updated_by = NULLIF(BTRIM(p_actor), ''), updated_at = NOW()
    WHERE id = saved.id RETURNING * INTO saved;
  RETURN saved;
END $_$;


--
-- Name: create_opportunity_with_office_context_legacy("text", "uuid", "uuid"[], "uuid", "text", "public"."opportunity_status", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_opportunity_with_office_context_legacy"("p_reference" "text", "p_source_office_id" "uuid" DEFAULT NULL::"uuid", "p_affiliation_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_primary_affiliation_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_target_status" "public"."opportunity_status" DEFAULT 'draft'::"public"."opportunity_status", "p_actor" "text" DEFAULT NULL::"text", "p_opportunity_fields" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."opportunities"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  created_opportunity public.opportunities%ROWTYPE;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_office_context_actor_required';
  END IF;

  IF NULLIF(BTRIM(p_reference), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_reference_required';
  END IF;

  IF p_target_status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'opportunity_office_context_supports_draft_active_or_paused_only';
  END IF;

  INSERT INTO public.opportunities (
    reference,
    status,
    repreneur_exposure,
    description,
    created_by,
    updated_by
  ) VALUES (
    BTRIM(p_reference),
    'draft',
    'staff_only'::public.opportunity_visibility,
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_actor), ''),
    NULLIF(BTRIM(p_actor), '')
  )
  RETURNING * INTO created_opportunity;

  RETURN public.save_opportunity_office_context(
    created_opportunity.id,
    p_source_office_id,
    p_affiliation_ids,
    p_primary_affiliation_id,
    p_description,
    p_target_status,
    p_actor,
    p_opportunity_fields
  );
END;
$$;


--
-- Name: create_or_affiliate_ma_contact("uuid", "uuid", "text", "text", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_or_affiliate_ma_contact"("p_office_id" "uuid", "p_existing_contact_id" "uuid" DEFAULT NULL::"uuid", "p_contact_first_name" "text" DEFAULT NULL::"text", "p_contact_last_name" "text" DEFAULT NULL::"text", "p_contact_email" "text" DEFAULT NULL::"text", "p_contact_phone" "text" DEFAULT NULL::"text", "p_contact_job_title" "text" DEFAULT NULL::"text", "p_actor" "text" DEFAULT NULL::"text") RETURNS TABLE("contact_id" "uuid", "affiliation_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  actor TEXT;
  contact_first_name TEXT;
  contact_last_name TEXT;
  contact_email TEXT;
  contact_phone TEXT;
  office_row public.ma_offices%ROWTYPE;
  firm_row public.ma_firms%ROWTYPE;
  contact_row public.ma_contacts%ROWTYPE;
  resolved_contact_id UUID;
  created_affiliation_id UUID;
  existing_affiliation_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  contact_first_name := NULLIF(BTRIM(p_contact_first_name), '');
  contact_last_name := NULLIF(BTRIM(p_contact_last_name), '');
  contact_email := NULLIF(BTRIM(p_contact_email), '');
  contact_phone := NULLIF(BTRIM(p_contact_phone), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_contact_affiliation_actor_required';
  END IF;

  -- Lock the office first so two calls cannot race past the active-pair
  -- guard. The firm lock makes an office beneath an archived firm ineligible
  -- for a new operational contact relationship.
  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = p_office_id
  FOR UPDATE;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_contact_affiliation_office_not_found';
  END IF;

  IF office_row.status <> 'active' THEN
    RAISE EXCEPTION 'ma_contact_affiliation_requires_active_office';
  END IF;

  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = office_row.firm_id
  FOR SHARE;

  IF firm_row.id IS NULL OR firm_row.status = 'archived' THEN
    RAISE EXCEPTION 'ma_contact_affiliation_requires_non_archived_firm';
  END IF;

  IF p_existing_contact_id IS NOT NULL THEN
    -- This primitive affiliates an existing identity; it does not quietly
    -- become a contact-profile editor. Updates are a separate audited action.
    IF contact_first_name IS NOT NULL
      OR contact_last_name IS NOT NULL
      OR contact_email IS NOT NULL
      OR contact_phone IS NOT NULL THEN
      RAISE EXCEPTION 'ma_existing_contact_affiliation_must_not_supply_identity_fields';
    END IF;

    SELECT *
    INTO contact_row
    FROM public.ma_contacts
    WHERE id = p_existing_contact_id
    FOR UPDATE;

    IF contact_row.id IS NULL THEN
      RAISE EXCEPTION 'ma_contact_not_found';
    END IF;

    IF contact_row.status <> 'active' THEN
      RAISE EXCEPTION 'ma_contact_affiliation_requires_active_contact';
    END IF;

    resolved_contact_id := contact_row.id;
  ELSE
    IF contact_first_name IS NULL AND contact_last_name IS NULL THEN
      RAISE EXCEPTION 'ma_contact_requires_name_component';
    END IF;

    INSERT INTO public.ma_contacts (
      first_name,
      last_name,
      email,
      phone,
      created_by,
      updated_by
    ) VALUES (
      contact_first_name,
      contact_last_name,
      contact_email,
      contact_phone,
      actor,
      actor
    )
    RETURNING id INTO resolved_contact_id;
  END IF;

  SELECT affiliation.id
  INTO existing_affiliation_id
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.contact_id = resolved_contact_id
    AND affiliation.office_id = office_row.id
    AND affiliation.is_active
  FOR UPDATE;

  IF existing_affiliation_id IS NOT NULL THEN
    RAISE EXCEPTION 'ma_contact_office_affiliation_already_active';
  END IF;

  -- An earlier ended affiliation remains immutable relationship history. A
  -- later return to the same office receives a new active relationship row.
  INSERT INTO public.ma_contact_office_affiliations (
    contact_id,
    office_id,
    job_title,
    created_by
  ) VALUES (
    resolved_contact_id,
    office_row.id,
    NULLIF(BTRIM(p_contact_job_title), ''),
    actor
  )
  RETURNING id INTO created_affiliation_id;

  RETURN QUERY
  SELECT resolved_contact_id, created_affiliation_id;
END;
$$;


--
-- Name: delete_external_pursuit_attachment_record("uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."delete_external_pursuit_attachment_record"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; deleted_path TEXT; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT storage_path INTO deleted_path FROM public.external_pursuit_attachments WHERE id=p_attachment_id AND external_pursuit_id=p_dossier_id;
  IF deleted_path IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events e WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key AND e.event_type='updated' AND e.metadata->>'kind'='attachment_deleted') THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'External Pursuit attachment not found.';
  END IF;
  -- The application must delete this object before it calls this final metadata step.
  RETURN deleted_path;
END $$;


--
-- Name: enforce_ma_firm_active_office(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_ma_firm_active_office"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'ma_firms' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    PERFORM public.assert_ma_firm_has_active_office(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.assert_ma_firm_has_active_office(OLD.firm_id);
  ELSE
    PERFORM public.assert_ma_firm_has_active_office(NEW.firm_id);
    IF TG_OP = 'UPDATE' AND NEW.firm_id IS DISTINCT FROM OLD.firm_id THEN
      PERFORM public.assert_ma_firm_has_active_office(OLD.firm_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_ma_interaction_office_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_ma_interaction_office_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  affiliation_office_id UUID;
  opportunity_office_id UUID;
BEGIN
  IF NEW.affiliation_id IS NOT NULL THEN
    SELECT affiliation.office_id
    INTO affiliation_office_id
    FROM public.ma_contact_office_affiliations affiliation
    WHERE affiliation.id = NEW.affiliation_id;

    IF affiliation_office_id IS NULL OR affiliation_office_id IS DISTINCT FROM NEW.office_id THEN
      RAISE EXCEPTION 'ma_interaction_affiliation_must_match_office';
    END IF;
  END IF;

  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT opportunity.source_office_id
    INTO opportunity_office_id
    FROM public.opportunities opportunity
    WHERE opportunity.id = NEW.opportunity_id;

    IF opportunity_office_id IS NULL OR opportunity_office_id IS DISTINCT FROM NEW.office_id THEN
      RAISE EXCEPTION 'ma_interaction_opportunity_must_match_office';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_ma_provisional_source_review_on_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_ma_provisional_source_review_on_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.assert_ma_provisional_source_review_state(NEW.opportunity_id);
  RETURN NEW;
END;
$$;


--
-- Name: enforce_ma_provisional_source_review_on_opportunity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_ma_provisional_source_review_on_opportunity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.assert_ma_provisional_source_review_state(NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: enforce_opportunity_office_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_opportunity_office_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  affected_opportunity_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.assert_opportunity_office_context(OLD.id);
    ELSE
      PERFORM public.assert_opportunity_office_context(NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'opportunity_ma_contacts' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.assert_opportunity_office_context(OLD.opportunity_id);
    ELSE
      PERFORM public.assert_opportunity_office_context(NEW.opportunity_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'ma_contact_office_affiliations' THEN
    FOR affected_opportunity_id IN
      SELECT DISTINCT link.opportunity_id
      FROM public.opportunity_ma_contacts link
      WHERE link.affiliation_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
        AND link.is_active
    LOOP
      PERFORM public.assert_opportunity_office_context(affected_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'ma_contacts' THEN
    FOR affected_opportunity_id IN
      SELECT DISTINCT link.opportunity_id
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.id = link.affiliation_id
      WHERE affiliation.contact_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
        AND link.is_active
    LOOP
      PERFORM public.assert_opportunity_office_context(affected_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'ma_offices' THEN
    FOR affected_opportunity_id IN
      SELECT DISTINCT opportunity.id
      FROM public.opportunities opportunity
      JOIN public.ma_offices source_office
        ON source_office.id = opportunity.source_office_id
      WHERE source_office.firm_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.firm_id ELSE NEW.firm_id END
    LOOP
      PERFORM public.assert_opportunity_office_context(affected_opportunity_id);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_opportunity_source_contact_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_opportunity_source_contact_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  expected_source_id UUID;
BEGIN
  SELECT source_id
  INTO expected_source_id
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;

  IF expected_source_id IS NULL OR expected_source_id <> NEW.source_id THEN
    RAISE EXCEPTION 'opportunity_source_contact_source_mismatch';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: express_locked_opportunity_interest("uuid", "uuid", "text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."express_locked_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("match_id" "uuid", "expressed_at" timestamp with time zone, "notification_sent_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_active_match_id UUID;
  v_match public.opportunity_matches%ROWTYPE;
BEGIN
  -- Only active opportunities deliberately exposed to repreneurs are eligible.
  -- Lock the opportunity row for the duration of this transaction so status or
  -- exposure changes cannot race the interest write.
  PERFORM 1
  FROM public.opportunities
  WHERE id = p_opportunity_id
    AND status = 'active'
    AND repreneur_exposure <> 'staff_only'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'locked_interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- The action exists only while a different repreneur owns the active pursuit.
  -- The row lock serializes this signal with a concurrent drop/reassignment.
  SELECT id
  INTO v_active_match_id
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND status = 'active_pursuit'
    AND repreneur_id <> p_repreneur_id
  LIMIT 1
  FOR UPDATE;

  IF v_active_match_id IS NULL THEN
    RAISE EXCEPTION 'locked_interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_match
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND repreneur_id = p_repreneur_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_match.status = 'active_pursuit' THEN
      RAISE EXCEPTION 'locked_interest_not_available' USING ERRCODE = 'P0001';
    END IF;

    -- Once both the signal and its email are recorded, repeated actions are a
    -- true no-op. If the email failed, keep the original expressed-at timestamp
    -- and let the application retry only the notification.
    IF v_match.status = 'interested'
      AND v_match.interest_expressed_at IS NOT NULL THEN
      RETURN QUERY SELECT
        v_match.id,
        v_match.interest_expressed_at,
        v_match.interest_notification_sent_at;
      RETURN;
    END IF;

    UPDATE public.opportunity_matches
    SET
      status = 'interested',
      decline_reason_categories = '{}',
      decline_reason_text = NULL,
      pursuit_stage = NULL,
      pursuit_stage_notes = NULL,
      pursuit_stage_updated_by = NULL,
      pursuit_stage_updated_at = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      interest_expressed_at = p_expressed_at,
      interest_notification_sent_at = NULL
    WHERE id = v_match.id
    RETURNING * INTO v_match;
  ELSE
    INSERT INTO public.opportunity_matches (
      opportunity_id,
      repreneur_id,
      status,
      created_by,
      interest_expressed_at
    )
    VALUES (
      p_opportunity_id,
      p_repreneur_id,
      'interested',
      p_actor_id,
      p_expressed_at
    )
    RETURNING * INTO v_match;
  END IF;

  RETURN QUERY SELECT
    v_match.id,
    v_match.interest_expressed_at,
    v_match.interest_notification_sent_at;
END;
$$;


--
-- Name: express_opportunity_interest("uuid", "uuid", "text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."express_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("match_id" "uuid", "expressed_at" timestamp with time zone, "notification_sent_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_opportunity public.opportunities%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_has_match BOOLEAN := FALSE;
BEGIN
  -- Serializes visibility and active-status eligibility with concurrent
  -- opportunity changes before inspecting the caller's exact match.
  SELECT * INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the caller's pair before changing it. Their existing active pursuit
  -- is never converted back into an interest signal.
  SELECT * INTO v_match
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND repreneur_id = p_repreneur_id
  FOR UPDATE;

  v_has_match := FOUND;

  -- Unmatched staff_only opportunities remain undiscoverable. A staff_only
  -- opportunity is actionable only through the caller's exact current portal
  -- match; dropped, draft and shortlisted rows are not portal-visible and
  -- cannot be revived through this action.
  IF v_opportunity.repreneur_exposure = 'staff_only'
    AND (
      NOT v_has_match
      OR v_match.status NOT IN ('proposed', 'interested', 'declined', 'active_pursuit')
    ) THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  IF v_has_match AND v_match.status = 'active_pursuit' THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- Some legacy rows predate the evidence constraints and may carry a signed
  -- or waived label without its required audit evidence. Updating any column
  -- on those rows would trip the NOT VALID constraint. Fail closed instead of
  -- inferring evidence, clearing confidentiality history, or exposing a raw
  -- database error to the repreneur.
  IF v_has_match AND (
    (v_match.nda_status = 'signed' AND v_match.nda_signed_at IS NULL)
    OR (
      v_match.nda_status = 'waived'
      AND (
        v_match.nda_waived_at IS NULL
        OR NULLIF(BTRIM(v_match.nda_waived_by), '') IS NULL
      )
    )
  ) THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- The existing partial unique index remains the concurrency authority for
  -- active pursuits. We lock another owner's row only to serialize a drop or
  -- reassignment with this signal; it is not modified here.
  PERFORM 1
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND status = 'active_pursuit'
    AND repreneur_id <> p_repreneur_id
  FOR UPDATE;

  IF v_has_match AND v_match.status = 'interested' THEN
    -- Existing history without the 067 signal timestamp remains ordinary
    -- interest history. Never silently reinterpret or notify it as a new
    -- self-discovered request.
    IF v_match.interest_expressed_at IS NULL THEN
      RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_match.id, v_match.interest_expressed_at, v_match.interest_notification_sent_at;
    RETURN;
  END IF;

  IF v_has_match THEN
    UPDATE public.opportunity_matches
    SET
      status = 'interested',
      decline_reason_categories = '{}',
      decline_reason_text = NULL,
      pursuit_stage = NULL,
      pursuit_stage_notes = NULL,
      pursuit_stage_updated_by = NULL,
      pursuit_stage_updated_at = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      interest_expressed_at = p_expressed_at,
      interest_notification_sent_at = NULL
    WHERE id = v_match.id
    RETURNING * INTO v_match;
  ELSE
    INSERT INTO public.opportunity_matches (
      opportunity_id,
      repreneur_id,
      status,
      created_by,
      interest_expressed_at
    )
    VALUES (
      p_opportunity_id,
      p_repreneur_id,
      'interested',
      p_actor_id,
      p_expressed_at
    )
    RETURNING * INTO v_match;
  END IF;

  RETURN QUERY SELECT v_match.id, v_match.interest_expressed_at, v_match.interest_notification_sent_at;
END;
$$;


--
-- Name: external_pursuit_actor_context("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_actor_context"("p_actor_user_id" "text") RETURNS TABLE("role" "public"."app_user_role", "repreneur_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT r.role, r.repreneur_id FROM public.app_user_roles r
  WHERE r.user_id = NULLIF(BTRIM(p_actor_user_id), '')
  ORDER BY CASE r.role WHEN 'staff' THEN 0 ELSE 1 END LIMIT 1
$$;


--
-- Name: external_pursuit_append_audit("uuid", "public"."external_pursuit_audit_event_type", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_append_audit"("p_dossier_id" "uuid", "p_event" "public"."external_pursuit_audit_event_type", "p_actor" "text", "p_key" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  INSERT INTO public.external_pursuit_audit_events (external_pursuit_id,event_type,actor_user_id,idempotency_key,metadata)
  VALUES (p_dossier_id,p_event,p_actor,p_key,COALESCE(p_metadata,'{}'::jsonb)) ON CONFLICT DO NOTHING
$$;


--
-- Name: external_pursuit_attachment_cleanup_for_fulfillment("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_attachment_cleanup_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") RETURNS TABLE("id" "uuid", "storage_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE;
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, TRUE);
  IF p.deletion_status <> 'delete_requested' THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
  RETURN QUERY SELECT a.id, a.storage_path FROM public.external_pursuit_attachments a
  WHERE a.external_pursuit_id=p_dossier_id ORDER BY a.created_at ASC;
END $$;


--
-- Name: external_pursuit_attachment_for_actor("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_attachment_for_actor"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text") RETURNS TABLE("storage_path" "text", "original_filename" "text", "content_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, FALSE);
  RETURN QUERY SELECT a.storage_path, a.original_filename, a.content_type
  FROM public.external_pursuit_attachments a
  WHERE a.id = p_attachment_id AND a.external_pursuit_id = p_dossier_id;
END $$;


--
-- Name: external_pursuit_attachment_map_for_actor("uuid"[], "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_attachment_map_for_actor"("p_dossier_ids" "uuid"[], "p_actor_user_id" "text") RETURNS TABLE("external_pursuit_id" "uuid", "id" "uuid", "original_filename" "text", "content_type" "text", "byte_size" bigint, "uploader_label" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  requested_dossier_id UUID;
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  -- Preserve the single-dossier reader's fail-closed rule for every requested
  -- dossier. A mixed permitted/forbidden request must not return a partial map.
  FOR requested_dossier_id IN
    SELECT DISTINCT requested.id
    FROM unnest(COALESCE(p_dossier_ids, ARRAY[]::UUID[])) AS requested(id)
  LOOP
    PERFORM public.assert_external_pursuit_access(requested_dossier_id, actor, FALSE);
  END LOOP;

  RETURN QUERY
  SELECT
    a.external_pursuit_id,
    a.id,
    a.original_filename,
    a.content_type,
    a.byte_size,
    CASE
      WHEN a.created_by = actor THEN 'You'::TEXT
      WHEN EXISTS (
        SELECT 1
        FROM public.app_user_roles r
        WHERE r.user_id = a.created_by AND r.role = 'staff'
      ) THEN 'Re-New staff'::TEXT
      ELSE 'Dossier owner'::TEXT
    END,
    a.created_at
  FROM public.external_pursuit_attachments a
  WHERE a.external_pursuit_id = ANY(COALESCE(p_dossier_ids, ARRAY[]::UUID[]))
  ORDER BY a.external_pursuit_id, a.created_at ASC;
END $$;


--
-- Name: external_pursuit_attachment_upload_replay("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_attachment_upload_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE attachment_id UUID;
BEGIN
  PERFORM public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, FALSE);
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT (e.metadata->>'attachment_id')::UUID INTO attachment_id
  FROM public.external_pursuit_audit_events e
  WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=NULLIF(BTRIM(p_actor_user_id),'')
    AND e.idempotency_key=p_idempotency_key AND e.event_type='updated'
    AND e.metadata->>'kind'='attachment_uploaded'
  LIMIT 1;
  IF attachment_id IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object('attachment_id',a.id,'storage_path',a.storage_path) FROM public.external_pursuit_attachments a WHERE a.id=attachment_id);
END $$;


--
-- Name: external_pursuit_attachments_for_actor("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_attachments_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text") RETURNS TABLE("id" "uuid", "original_filename" "text", "content_type" "text", "byte_size" bigint, "uploader_label" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, FALSE);
  RETURN QUERY SELECT a.id, a.original_filename, a.content_type, a.byte_size,
    CASE
      WHEN a.created_by = NULLIF(BTRIM(p_actor_user_id), '') THEN 'You'::TEXT
      WHEN EXISTS (SELECT 1 FROM public.app_user_roles r WHERE r.user_id=a.created_by AND r.role='staff') THEN 'Re-New staff'::TEXT
      ELSE 'Dossier owner'::TEXT
    END,
    a.created_at
  FROM public.external_pursuit_attachments a
  WHERE a.external_pursuit_id = p_dossier_id
  ORDER BY a.created_at ASC;
END $$;


--
-- Name: external_pursuit_board_for_actor("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_board_for_actor"("p_actor_user_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role; actor_owner UUID;
BEGIN
  SELECT role, repreneur_id INTO actor_role, actor_owner FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS NULL THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'owner_repreneur_id', p.owner_repreneur_id,
        'owner_name', NULLIF(BTRIM(CONCAT_WS(' ', r.first_name, r.last_name)), ''),
        'title', p.title, 'stage', p.stage, 'availability', p.availability,
        'deletion_status', p.deletion_status,
        'is_open_capacity', p.deletion_status = 'active'
          AND p.stage NOT IN ('completed', 'dropped_archived')
          AND NOT EXISTS (
            SELECT 1 FROM public.external_pursuit_opportunity_conversions conversion
            WHERE conversion.external_pursuit_id = p.id
          ),
        'external_url', p.external_url, 'target_company', p.target_company,
        'source_channel', p.source_channel, 'revenue_meur', p.revenue_meur,
        'ebitda_keur', p.ebitda_keur, 'headcount', p.headcount,
        'next_action', p.next_action, 'responsible_party', p.responsible_party,
        'due_at', p.due_at,
        'shared_notes', (SELECT n.shared_notes FROM public.external_pursuit_notes n WHERE n.external_pursuit_id = p.id),
        'contacts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.name, 'organisation', c.organisation,
            'role_title', c.role_title, 'email', c.email, 'phone', c.phone
          ) ORDER BY c.created_at)
          FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id = p.id
        ), '[]'::jsonb),
        'updated_at', p.updated_at
      ) || CASE WHEN actor_role = 'staff' THEN jsonb_build_object(
        'staff_internal_notes', (
          SELECT n.staff_internal_notes FROM public.external_pursuit_staff_notes n
          WHERE n.external_pursuit_id = p.id
        )
      ) ELSE '{}'::jsonb END
      ORDER BY p.updated_at DESC
    )
    FROM public.external_pursuits p
    JOIN public.repreneurs r ON r.id = p.owner_repreneur_id
    WHERE actor_role = 'staff'
      OR (p.owner_repreneur_id = actor_owner AND p.deletion_status = 'active')
  ), '[]'::jsonb);
END $$;


--
-- Name: external_pursuit_capacity_for_staff("text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_capacity_for_staff"("p_actor_user_id" "text", "p_as_of" timestamp with time zone DEFAULT "clock_timestamp"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  actor_role public.app_user_role;
  as_of_value TIMESTAMPTZ := COALESCE(p_as_of, clock_timestamp());
  paris_today DATE;
  paris_offset_minutes INTEGER;
  paris_timestamp TEXT;
  payload JSONB;
BEGIN
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;

  paris_today := (as_of_value AT TIME ZONE 'Europe/Paris')::DATE;
  paris_offset_minutes := (
    EXTRACT(EPOCH FROM (
      (as_of_value AT TIME ZONE 'Europe/Paris')
      - (as_of_value AT TIME ZONE 'UTC')
    )) / 60
  )::INTEGER;
  paris_timestamp :=
    to_char(as_of_value AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI:SS')
    || CASE WHEN paris_offset_minutes >= 0 THEN '+' ELSE '-' END
    || lpad((ABS(paris_offset_minutes) / 60)::TEXT, 2, '0')
    || ':'
    || lpad((ABS(paris_offset_minutes) % 60)::TEXT, 2, '0');

  WITH open_dossiers AS (
    SELECT
      dossier.id,
      dossier.owner_repreneur_id,
      dossier.title,
      dossier.stage::TEXT AS stage,
      dossier.availability::TEXT AS availability,
      dossier.due_at,
      dossier.last_confirmed_at,
      CASE
        WHEN dossier.last_confirmed_at IS NULL THEN 'unknown'
        WHEN paris_today - (dossier.last_confirmed_at AT TIME ZONE 'Europe/Paris')::DATE <= 30 THEN 'fresh'
        ELSE 'stale'
      END AS freshness,
      CASE
        WHEN dossier.due_at IS NULL THEN 'none'
        WHEN dossier.due_at < paris_today THEN 'overdue'
        WHEN dossier.due_at = paris_today THEN 'today'
        ELSE 'upcoming'
      END AS due_state
    FROM public.external_pursuits dossier
    LEFT JOIN public.external_pursuit_opportunity_conversions conversion
      ON conversion.external_pursuit_id = dossier.id
    WHERE dossier.deletion_status = 'active'
      AND dossier.stage NOT IN ('completed', 'dropped_archived')
      AND conversion.external_pursuit_id IS NULL
  ),
  linked_dossiers AS (
    SELECT
      dossier.id,
      dossier.title,
      dossier.stage::TEXT AS stage,
      conversion.opportunity_id,
      opportunity.reference AS opportunity_reference,
      conversion.converted_at
    FROM public.external_pursuit_opportunity_conversions conversion
    JOIN public.external_pursuits dossier ON dossier.id = conversion.external_pursuit_id
    JOIN public.opportunities opportunity ON opportunity.id = conversion.opportunity_id
  )
  SELECT jsonb_build_object(
    'as_of_paris_date', paris_today,
    'as_of_paris_timestamp', paris_timestamp,
    'open_capacity', jsonb_build_object(
      'total', (SELECT count(*) FROM open_dossiers),
      'stage', jsonb_build_object(
        'identified', (SELECT count(*) FROM open_dossiers WHERE stage = 'identified'),
        'contact_qualification', (SELECT count(*) FROM open_dossiers WHERE stage = 'contact_qualification'),
        'information', (SELECT count(*) FROM open_dossiers WHERE stage = 'information'),
        'meetings', (SELECT count(*) FROM open_dossiers WHERE stage = 'meetings'),
        'negotiation', (SELECT count(*) FROM open_dossiers WHERE stage = 'negotiation'),
        'loi', (SELECT count(*) FROM open_dossiers WHERE stage = 'loi'),
        'due_diligence_financing', (SELECT count(*) FROM open_dossiers WHERE stage = 'due_diligence_financing'),
        'completed', (SELECT count(*) FROM open_dossiers WHERE stage = 'completed'),
        'dropped_archived', (SELECT count(*) FROM open_dossiers WHERE stage = 'dropped_archived')
      ),
      'availability', jsonb_build_object(
        'available', (SELECT count(*) FROM open_dossiers WHERE availability = 'available'),
        'limited', (SELECT count(*) FROM open_dossiers WHERE availability = 'limited'),
        'unavailable', (SELECT count(*) FROM open_dossiers WHERE availability = 'unavailable'),
        'unknown', (SELECT count(*) FROM open_dossiers WHERE availability = 'unknown')
      ),
      'freshness', jsonb_build_object(
        'fresh', (SELECT count(*) FROM open_dossiers WHERE freshness = 'fresh'),
        'stale', (SELECT count(*) FROM open_dossiers WHERE freshness = 'stale'),
        'unknown', (SELECT count(*) FROM open_dossiers WHERE freshness = 'unknown')
      ),
      'due', jsonb_build_object(
        'overdue', (SELECT count(*) FROM open_dossiers WHERE due_state = 'overdue'),
        'today', (SELECT count(*) FROM open_dossiers WHERE due_state = 'today'),
        'upcoming', (SELECT count(*) FROM open_dossiers WHERE due_state = 'upcoming'),
        'none', (SELECT count(*) FROM open_dossiers WHERE due_state = 'none')
      )
    ),
    'open_dossiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'owner_repreneur_id', owner_repreneur_id,
        'title', title,
        'stage', stage,
        'availability', availability,
        'due_at', due_at,
        'due_state', due_state,
        'last_confirmed_at', last_confirmed_at,
        'freshness', freshness
      ) ORDER BY
        CASE due_state WHEN 'overdue' THEN 0 WHEN 'today' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,
        due_at NULLS LAST,
        title
      ) FROM open_dossiers
    ), '[]'::JSONB),
    'linked_dossiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'stage', stage,
        'opportunity_id', opportunity_id,
        'opportunity_reference', opportunity_reference,
        'converted_at', converted_at
      ) ORDER BY converted_at DESC) FROM linked_dossiers
    ), '[]'::JSONB)
  ) INTO payload;

  RETURN payload;
END;
$$;


--
-- Name: external_pursuit_deletion_fulfillment_replay("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_deletion_fulfillment_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role; stored_key TEXT;
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'staff' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  SELECT fulfillment_idempotency_key INTO stored_key
  FROM public.external_pursuit_deletion_tombstones
  WHERE former_dossier_id=p_dossier_id;
  IF stored_key IS NULL THEN RETURN FALSE; END IF;
  IF stored_key <> p_idempotency_key THEN RAISE EXCEPTION 'External Pursuit deletion fulfillment idempotency conflict.'; END IF;
  RETURN TRUE;
END $$;


--
-- Name: external_pursuit_for_actor("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."external_pursuit_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor_role public.app_user_role; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE); SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role='staff' THEN RETURN jsonb_build_object('pursuit',jsonb_build_object('id',p.id,'owner_repreneur_id',p.owner_repreneur_id,'title',p.title,'stage',p.stage,'availability',p.availability,'next_action',p.next_action,'responsible_party',p.responsible_party,'due_at',p.due_at,'external_url',p.external_url,'target_company',p.target_company,'source_channel',p.source_channel,'revenue_meur',p.revenue_meur,'ebitda_keur',p.ebitda_keur,'headcount',p.headcount,'deletion_status',p.deletion_status,'created_by',p.created_by,'created_at',p.created_at,'updated_by',p.updated_by,'updated_at',p.updated_at),'shared_notes',COALESCE((SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id=p.id),NULL),'staff_internal_notes',COALESCE((SELECT staff_internal_notes FROM public.external_pursuit_staff_notes WHERE external_pursuit_id=p.id),NULL),'contacts',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id=p.id),'[]'::jsonb),'audit',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'event_type',a.event_type,'actor_user_id',a.actor_user_id,'occurred_at',a.occurred_at,'metadata',a.metadata) ORDER BY a.occurred_at) FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p.id),'[]'::jsonb)); END IF;
  RETURN jsonb_build_object('pursuit',jsonb_build_object('id',p.id,'owner_repreneur_id',p.owner_repreneur_id,'title',p.title,'stage',p.stage,'availability',p.availability,'next_action',p.next_action,'responsible_party',p.responsible_party,'due_at',p.due_at,'external_url',p.external_url,'target_company',p.target_company,'source_channel',p.source_channel,'revenue_meur',p.revenue_meur,'ebitda_keur',p.ebitda_keur,'headcount',p.headcount,'deletion_status',p.deletion_status,'created_at',p.created_at,'updated_at',p.updated_at),'shared_notes',COALESCE((SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id=p.id),NULL),'contacts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'organisation',c.organisation,'role_title',c.role_title,'email',c.email,'phone',c.phone,'created_at',c.created_at,'updated_at',c.updated_at) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id=p.id),'[]'::jsonb));
END $$;


--
-- Name: fail_opportunity_memo_notification("uuid", timestamp with time zone, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fail_opportunity_memo_notification"("p_match_id" "uuid", "p_failed_at" timestamp with time zone DEFAULT "now"(), "p_error" "text" DEFAULT 'Email delivery failed'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.opportunity_memo_notifications
  SET
    status = 'failed',
    failed_at = p_failed_at,
    last_error = LEFT(p_error, 1000),
    updated_at = p_failed_at
  WHERE match_id = p_match_id
    AND sent_at IS NULL;
END;
$$;


--
-- Name: finalize_external_pursuit_attachment_deletion("uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."finalize_external_pursuit_attachment_deletion"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events e WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key AND e.event_type='updated' AND e.metadata->>'kind'='attachment_deleted') THEN RETURN; END IF;
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  DELETE FROM public.external_pursuit_attachments WHERE id=p_attachment_id AND external_pursuit_id=p_dossier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'External Pursuit attachment not found.'; END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'updated',actor,p_idempotency_key,jsonb_build_object('kind','attachment_deleted','attachment_id',p_attachment_id));
END $$;


--
-- Name: finalize_idempotent_email_delivery("uuid", "text", timestamp with time zone, "date"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."finalize_idempotent_email_delivery"("p_email_log_id" "uuid", "p_resend_id" "text", "p_sent_at" timestamp with time zone, "p_target_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  existing public.email_logs%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM public.email_logs
  WHERE id = p_email_log_id
  FOR UPDATE;

  IF NOT FOUND OR existing.idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotent email log was not found.';
  END IF;

  IF existing.daily_counted_at IS NULL THEN
    INSERT INTO public.email_daily_counts AS daily_counts (date, count)
    VALUES (p_target_date, 1)
    ON CONFLICT (date)
    DO UPDATE SET count = daily_counts.count + 1;
  END IF;

  UPDATE public.email_logs
  SET status = CASE
        WHEN existing.status IN ('delivered', 'opened', 'clicked') THEN existing.status
        ELSE 'sent'
      END,
      resend_id = COALESCE(existing.resend_id, p_resend_id),
      sent_at = COALESCE(existing.sent_at, p_sent_at),
      daily_counted_at = COALESCE(existing.daily_counted_at, p_sent_at),
      provider_outcome = 'accepted',
      error_message = NULL
  WHERE id = p_email_log_id;

  RETURN TRUE;
END;
$$;


--
-- Name: finalize_ma_interaction_email_send("uuid", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."finalize_ma_interaction_email_send"("p_interaction_id" "uuid", "p_actor" "text", "p_delivery_status" "text", "p_provider_message_id" "text" DEFAULT NULL::"text", "p_delivery_error" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  normalized_actor TEXT;
  interaction_row public.ma_interactions%ROWTYPE;
  staff_count INTEGER;
BEGIN
  normalized_actor := NULLIF(BTRIM(p_actor), '');
  IF normalized_actor IS NULL OR p_delivery_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_valid_input';
  END IF;

  SELECT COUNT(*) INTO staff_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff' AND role.user_id = normalized_actor;
  IF staff_count <> 1 THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_exact_staff_actor';
  END IF;

  SELECT * INTO interaction_row
  FROM public.ma_interactions interaction
  WHERE interaction.id = p_interaction_id
  FOR UPDATE;
  IF interaction_row.id IS NULL
    OR interaction_row.owner_staff_user_id IS DISTINCT FROM normalized_actor
    OR interaction_row.created_by IS DISTINCT FROM normalized_actor
    OR interaction_row.delivery_status <> 'pending' THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_owned_pending_interaction';
  END IF;
  IF p_delivery_status = 'sent' AND NULLIF(BTRIM(p_provider_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_provider_message_id';
  END IF;
  IF p_delivery_status = 'failed' AND NULLIF(BTRIM(p_delivery_error), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_delivery_error';
  END IF;

  PERFORM set_config('app.ma_interaction_delivery_finalization', 'true', true);
  UPDATE public.ma_interactions
  SET delivery_status = p_delivery_status,
      provider_message_id = NULLIF(BTRIM(p_provider_message_id), ''),
      delivery_error = CASE WHEN p_delivery_status = 'failed' THEN BTRIM(p_delivery_error) ELSE NULL END,
      sent_at = CASE WHEN p_delivery_status = 'sent' THEN NOW() ELSE NULL END,
      delivery_finalized_at = NOW()
  WHERE id = interaction_row.id;

  INSERT INTO public.ma_interaction_delivery_events (
    interaction_id, event_kind, actor, provider_idempotency_key,
    provider_message_id, delivery_error
  ) VALUES (
    interaction_row.id, p_delivery_status, normalized_actor, interaction_row.provider_idempotency_key,
    NULLIF(BTRIM(p_provider_message_id), ''),
    CASE WHEN p_delivery_status = 'failed' THEN BTRIM(p_delivery_error) ELSE NULL END
  );

  RETURN TRUE;
END;
$$;


--
-- Name: fulfill_external_pursuit_deletion("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."fulfill_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); request_actor TEXT; request_at TIMESTAMPTZ; actor_role public.app_user_role; stored_key TEXT;
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS DISTINCT FROM 'staff' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));
  SELECT fulfillment_idempotency_key INTO stored_key FROM public.external_pursuit_deletion_tombstones WHERE former_dossier_id=p_dossier_id;
  IF stored_key IS NOT NULL THEN
    IF stored_key = p_idempotency_key THEN RETURN; END IF;
    RAISE EXCEPTION 'External Pursuit deletion fulfillment idempotency conflict.';
  END IF;
  PERFORM public.prepare_external_pursuit_deletion_fulfillment(p_dossier_id, actor);
  p := public.assert_external_pursuit_access(p_dossier_id,actor,TRUE);
  IF p.deletion_status <> 'delete_requested' THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
  SELECT actor_user_id,occurred_at INTO request_actor,request_at FROM public.external_pursuit_audit_events WHERE external_pursuit_id=p_dossier_id AND event_type='delete_requested' ORDER BY occurred_at DESC LIMIT 1;
  IF request_actor IS NULL THEN RAISE EXCEPTION 'External Pursuit deletion evidence is missing.'; END IF;
  DELETE FROM public.external_pursuit_contacts WHERE external_pursuit_id=p_dossier_id;
  DELETE FROM public.external_pursuit_notes WHERE external_pursuit_id=p_dossier_id;
  DELETE FROM public.external_pursuit_staff_notes WHERE external_pursuit_id=p_dossier_id;
  INSERT INTO public.external_pursuit_deletion_tombstones (former_dossier_id,owner_repreneur_id,deletion_requested_by,deletion_requested_at,deletion_fulfilled_by,deletion_fulfilled_at,fulfillment_idempotency_key) VALUES (p.id,p.owner_repreneur_id,request_actor,request_at,actor,clock_timestamp(),p_idempotency_key);
  PERFORM set_config('wave.external_pursuit_delete_purge','on',TRUE);
  DELETE FROM public.external_pursuit_audit_events WHERE external_pursuit_id=p_dossier_id;
  DELETE FROM public.external_pursuits WHERE id=p_dossier_id;
END $$;


--
-- Name: get_follow_up_suggestions(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_follow_up_suggestions"("p_now" timestamp with time zone) RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "email" "text", "journey_stage" "text", "days_since_contact" integer, "total_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH eligible_repreneurs AS MATERIALIZED (
    SELECT r.id, r.first_name, r.last_name, r.email, r.journey_stage, r.updated_at
    FROM public.repreneurs AS r
    WHERE r.rejected_at IS NULL
      AND r.journey_stage NOT IN ('archived', 'rejected')
  ),
  latest_notes AS (
    SELECT n.repreneur_id, MAX(n.created_at) AS created_at
    FROM public.notes AS n
    INNER JOIN eligible_repreneurs AS r ON r.id = n.repreneur_id
    GROUP BY n.repreneur_id
  ),
  latest_activities AS (
    SELECT a.repreneur_id, MAX(a.created_at) AS created_at
    FROM public.activities AS a
    INNER JOIN eligible_repreneurs AS r ON r.id = a.repreneur_id
    GROUP BY a.repreneur_id
  ),
  contacts AS (
    SELECT
      r.id,
      r.first_name,
      r.last_name,
      r.email,
      r.journey_stage,
      r.updated_at AS source_updated_at,
      GREATEST(
        COALESCE(r.updated_at, '-infinity'::TIMESTAMPTZ),
        COALESCE(n.created_at, '-infinity'::TIMESTAMPTZ),
        COALESCE(a.created_at, '-infinity'::TIMESTAMPTZ)
      ) AS last_contact
    FROM eligible_repreneurs AS r
    LEFT JOIN latest_notes AS n ON n.repreneur_id = r.id
    LEFT JOIN latest_activities AS a ON a.repreneur_id = r.id
  ),
  stale_contacts AS (
    SELECT
      id,
      first_name,
      last_name,
      email,
      journey_stage,
      source_updated_at,
      last_contact,
      FLOOR(EXTRACT(EPOCH FROM (p_now - last_contact)) / 86400)::INTEGER AS days_since_contact
    FROM contacts
    WHERE last_contact > '-infinity'::TIMESTAMPTZ
      AND last_contact < p_now - INTERVAL '14 days'
  )
  SELECT
    id,
    first_name,
    last_name,
    email,
    journey_stage,
    days_since_contact,
    COUNT(*) OVER () AS total_count
  FROM stale_contacts
  ORDER BY days_since_contact DESC, source_updated_at ASC NULLS FIRST, id ASC
  LIMIT 10;
$$;


--
-- Name: guard_ma_contact_campaign_email_suppression(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_contact_campaign_email_suppression"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (
    OLD.campaign_email_suppressed
      IS DISTINCT FROM NEW.campaign_email_suppressed
    OR OLD.campaign_email_suppression_reason
      IS DISTINCT FROM NEW.campaign_email_suppression_reason
  )
  AND current_setting(
    'app.ma_contact_campaign_email_suppression_change',
    TRUE
  ) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'ma_contact_campaign_email_suppression_requires_service';
  END IF;

  RETURN NEW;
END
$$;


--
-- Name: guard_ma_cutover_run_immutability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_cutover_run_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  computed_digest TEXT;
BEGIN
  IF OLD.status IN ('activated', 'superseded') THEN
    RAISE EXCEPTION 'ma_cutover_closed_run_is_immutable';
  END IF;

  IF NEW.status IN ('activating', 'activated')
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NOT public.ma_cutover_activation_guard_present(OLD.id) THEN
    RAISE EXCEPTION 'ma_cutover_lifecycle_transition_requires_activation';
  END IF;

  IF NEW.status = 'activating' AND OLD.status <> 'approved' THEN
    RAISE EXCEPTION 'ma_cutover_activating_transition_requires_approved_status';
  END IF;

  IF NEW.status = 'activated' AND OLD.status <> 'activating' THEN
    RAISE EXCEPTION 'ma_cutover_activated_transition_requires_activating_status';
  END IF;

  IF NEW.status = 'superseded'
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NOT public.ma_cutover_supersession_guard_present(OLD.id) THEN
    RAISE EXCEPTION 'ma_cutover_lifecycle_transition_requires_supersession';
  END IF;

  IF NEW.status = 'superseded'
    AND OLD.status NOT IN ('draft', 'staged', 'review_required', 'approved') THEN
    RAISE EXCEPTION 'ma_cutover_superseded_transition_requires_open_status';
  END IF;

  IF (
    NEW.activation_actor IS DISTINCT FROM OLD.activation_actor
    OR NEW.activation_started_at IS DISTINCT FROM OLD.activation_started_at
    OR NEW.activated_by IS DISTINCT FROM OLD.activated_by
    OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
    OR NEW.result_summary IS DISTINCT FROM OLD.result_summary
  ) AND NOT public.ma_cutover_activation_guard_present(OLD.id) THEN
    RAISE EXCEPTION 'ma_cutover_activation_evidence_requires_activation';
  END IF;

  IF (
    NEW.superseded_by IS DISTINCT FROM OLD.superseded_by
    OR NEW.superseded_at IS DISTINCT FROM OLD.superseded_at
  ) AND NOT public.ma_cutover_supersession_guard_present(OLD.id) THEN
    RAISE EXCEPTION 'ma_cutover_supersession_evidence_requires_supersession';
  END IF;

  IF OLD.approval_digest IS NULL
    AND NEW.approval_digest IS NOT NULL
    AND NEW.status NOT IN ('approved', 'activating', 'activated') THEN
    RAISE EXCEPTION 'ma_cutover_approval_digest_requires_approved_status';
  END IF;

  IF OLD.approval_digest IS NOT NULL
    AND NEW.status NOT IN ('approved', 'activating', 'activated', 'superseded') THEN
    RAISE EXCEPTION 'ma_cutover_approved_status_is_immutable';
  END IF;

  -- Approval is a separate update after staging. Keeping the manifest stable
  -- here lets the database recompute against the exact stored rows and issues.
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF NEW.source_fingerprint IS DISTINCT FROM OLD.source_fingerprint
      OR NEW.source_hash IS DISTINCT FROM OLD.source_hash
      OR NEW.reconciliation_summary IS DISTINCT FROM OLD.reconciliation_summary
      OR NEW.review_decisions IS DISTINCT FROM OLD.review_decisions THEN
      RAISE EXCEPTION 'ma_cutover_approval_requires_stable_manifest';
    END IF;

    IF NULLIF(BTRIM(NEW.approved_by), '') IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'ma_cutover_approval_actor_and_time_required';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ma_cutover_stage_issues issue
      WHERE issue.run_id = NEW.id
        AND issue.severity = 'blocker'
        AND issue.resolved_at IS NULL
    ) THEN
      RAISE EXCEPTION 'ma_cutover_approval_has_unresolved_blockers';
    END IF;

    computed_digest := public.compute_ma_cutover_approval_digest(NEW.id);
    IF NEW.approval_digest IS NOT NULL
      AND BTRIM(NEW.approval_digest) IS DISTINCT FROM computed_digest THEN
      RAISE EXCEPTION 'ma_cutover_supplied_approval_digest_mismatch';
    END IF;
    NEW.approval_digest := computed_digest;
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


--
-- Name: guard_ma_cutover_run_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_cutover_run_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'staged', 'review_required') THEN
    RAISE EXCEPTION 'ma_cutover_run_must_start_open';
  END IF;

  IF NEW.approval_digest IS NOT NULL
    OR NEW.approved_by IS NOT NULL
    OR NEW.approved_at IS NOT NULL
    OR NEW.activation_actor IS NOT NULL
    OR NEW.activation_started_at IS NOT NULL
    OR NEW.activated_by IS NOT NULL
    OR NEW.activated_at IS NOT NULL
    OR NEW.superseded_by IS NOT NULL
    OR NEW.superseded_at IS NOT NULL
    OR NEW.result_summary IS NOT NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_must_start_without_lifecycle_evidence';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_cutover_stage_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_cutover_stage_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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
  FOR UPDATE;

  IF run_status IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_not_found';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF run_status = 'activating' THEN
      IF NOT public.ma_cutover_activation_guard_present(target_run_id) THEN
        RAISE EXCEPTION 'ma_cutover_stage_delete_requires_activation_guard';
      END IF;
      RETURN OLD;
    END IF;

    IF run_status = 'approved'
      AND public.ma_cutover_supersession_guard_present(target_run_id) THEN
      RETURN OLD;
    END IF;

    IF run_status IN ('approved', 'activated', 'superseded') THEN
      RAISE EXCEPTION 'ma_cutover_stage_is_immutable_after_approval';
    END IF;

    RETURN OLD;
  END IF;

  IF run_status IN ('approved', 'activated', 'superseded') THEN
    RAISE EXCEPTION 'ma_cutover_stage_is_immutable_after_approval';
  END IF;

  IF run_status = 'activating' THEN
    RAISE EXCEPTION 'ma_cutover_stage_is_locked_during_activation';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_interaction_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_interaction_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ma_interactions_are_append_only';
  END IF;

  IF current_setting('app.ma_interaction_owner_verification', true) = 'true' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.office_id IS DISTINCT FROM OLD.office_id
    OR NEW.affiliation_id IS DISTINCT FROM OLD.affiliation_id
    OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
    OR NEW.channel IS DISTINCT FROM OLD.channel
    OR NEW.direction IS DISTINCT FROM OLD.direction
    OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
    OR NEW.owner_staff_user_id IS DISTINCT FROM OLD.owner_staff_user_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.outcome IS DISTINCT FROM OLD.outcome
    OR NEW.next_action IS DISTINCT FROM OLD.next_action
    OR NEW.next_action_due_at IS DISTINCT FROM OLD.next_action_due_at
    OR NEW.template_key IS DISTINCT FROM OLD.template_key
    OR NEW.recipient_email_snapshot IS DISTINCT FROM OLD.recipient_email_snapshot
    OR NEW.body_markdown IS DISTINCT FROM OLD.body_markdown
    OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
    OR NEW.delivery_error IS DISTINCT FROM OLD.delivery_error
    OR NEW.client_operation_key IS DISTINCT FROM OLD.client_operation_key
    OR NEW.provider_idempotency_key IS DISTINCT FROM OLD.provider_idempotency_key
    OR NEW.provider_request_fingerprint IS DISTINCT FROM OLD.provider_request_fingerprint
    OR NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
    OR NEW.delivery_finalized_at IS DISTINCT FROM OLD.delivery_finalized_at
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.updated_by IS DISTINCT FROM OLD.updated_by
    OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
    OR OLD.owner_verification_state <> 'provisional'
    OR NEW.owner_verification_state <> 'verified'
    OR NEW.owner_verified_by IS NULL
    OR NEW.owner_verified_at IS NULL THEN
      RAISE EXCEPTION 'ma_interactions_are_append_only_except_owner_verification';
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('app.ma_interaction_delivery_finalization', true) = 'true' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.office_id IS DISTINCT FROM OLD.office_id
      OR NEW.affiliation_id IS DISTINCT FROM OLD.affiliation_id
      OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
      OR NEW.channel IS DISTINCT FROM OLD.channel
      OR NEW.direction IS DISTINCT FROM OLD.direction
      OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
      OR NEW.owner_staff_user_id IS DISTINCT FROM OLD.owner_staff_user_id
      OR NEW.owner_verification_state IS DISTINCT FROM OLD.owner_verification_state
      OR NEW.owner_verified_by IS DISTINCT FROM OLD.owner_verified_by
      OR NEW.owner_verified_at IS DISTINCT FROM OLD.owner_verified_at
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.summary IS DISTINCT FROM OLD.summary
      OR NEW.outcome IS DISTINCT FROM OLD.outcome
      OR NEW.next_action IS DISTINCT FROM OLD.next_action
      OR NEW.next_action_due_at IS DISTINCT FROM OLD.next_action_due_at
      OR NEW.template_key IS DISTINCT FROM OLD.template_key
      OR NEW.recipient_email_snapshot IS DISTINCT FROM OLD.recipient_email_snapshot
      OR NEW.body_markdown IS DISTINCT FROM OLD.body_markdown
      OR NEW.client_operation_key IS DISTINCT FROM OLD.client_operation_key
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.updated_by IS DISTINCT FROM OLD.updated_by
      OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
      OR OLD.delivery_status <> 'pending'
      OR NEW.delivery_status NOT IN ('sent', 'failed')
      OR NEW.provider_idempotency_key IS DISTINCT FROM OLD.provider_idempotency_key
      OR NEW.provider_request_fingerprint IS DISTINCT FROM OLD.provider_request_fingerprint
      OR NEW.delivery_finalized_at IS NULL
      OR (NEW.delivery_status = 'sent' AND (NEW.sent_at IS NULL OR NULLIF(BTRIM(NEW.provider_message_id), '') IS NULL))
      OR (NEW.delivery_status = 'failed' AND NULLIF(BTRIM(NEW.delivery_error), '') IS NULL) THEN
      RAISE EXCEPTION 'ma_interactions_are_append_only_except_delivery_finalization';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ma_interactions_are_append_only';
END;
$$;


--
-- Name: guard_ma_interaction_opportunity_source_office(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_interaction_opportunity_source_office"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.source_office_id IS DISTINCT FROM OLD.source_office_id THEN
    IF EXISTS (
      SELECT 1
      FROM public.ma_source_email_send_reservations reservation
      WHERE reservation.opportunity_id = OLD.id
        AND reservation.expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'ma_source_office_change_blocked_during_email_send';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ma_interactions interaction
      WHERE interaction.opportunity_id = OLD.id
        AND interaction.office_id IS DISTINCT FROM NEW.source_office_id
    ) THEN
      RAISE EXCEPTION 'ma_interaction_history_blocks_source_office_change';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_provisional_acme_firm_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_acme_firm_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  fixed_firm_id UUID;
BEGIN
  SELECT firm_id
  INTO fixed_firm_id
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF TG_OP = 'DELETE' THEN
    IF OLD.id = fixed_firm_id THEN
      RAISE EXCEPTION 'ma_provisional_acme_firm_is_immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF LOWER(BTRIM(NEW.name)) = 'acme co.'
    AND NEW.id IS DISTINCT FROM fixed_firm_id THEN
    RAISE EXCEPTION 'ma_provisional_acme_firm_identity_collision';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.id = fixed_firm_id
    AND (
      NEW.name IS DISTINCT FROM 'Acme Co.'
      OR NEW.status IS DISTINCT FROM 'active'
      OR NEW.archived_at IS NOT NULL
      OR NEW.archived_by IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'ma_provisional_acme_firm_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_provisional_acme_office_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_acme_office_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  fixed_firm_id UUID;
  fixed_office_id UUID;
BEGIN
  SELECT firm_id, office_id
  INTO fixed_firm_id, fixed_office_id
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF TG_OP = 'DELETE' THEN
    IF OLD.id = fixed_office_id THEN
      RAISE EXCEPTION 'ma_provisional_acme_office_is_immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF LOWER(BTRIM(NEW.name)) = 'acme paris'
    AND NEW.id IS DISTINCT FROM fixed_office_id THEN
    RAISE EXCEPTION 'ma_provisional_acme_office_identity_collision';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.id = fixed_office_id
    AND (
      NEW.firm_id IS DISTINCT FROM fixed_firm_id
      OR NEW.name IS DISTINCT FROM 'Acme Paris'
      OR NEW.city IS DISTINCT FROM 'Paris'
      OR NEW.status IS DISTINCT FROM 'active'
      OR NEW.is_default IS DISTINCT FROM FALSE
      OR NEW.archived_at IS NOT NULL
      OR NEW.archived_by IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'ma_provisional_acme_office_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_provisional_qa_person_affiliation_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_qa_person_affiliation_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  fixed_contact_id UUID;
  fixed_office_id UUID;
  fixed_affiliation_id UUID;
BEGIN
  SELECT contact_id, office_id, affiliation_id
  INTO fixed_contact_id, fixed_office_id, fixed_affiliation_id
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF TG_OP = 'DELETE' THEN
    IF OLD.id = fixed_affiliation_id THEN
      RAISE EXCEPTION 'ma_provisional_qa_person_affiliation_is_immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.id = fixed_affiliation_id
    AND (
      NEW.contact_id IS DISTINCT FROM fixed_contact_id
      OR NEW.office_id IS DISTINCT FROM fixed_office_id
      OR NEW.is_active IS DISTINCT FROM TRUE
      OR NEW.ended_at IS NOT NULL
      OR NEW.ended_by IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'ma_provisional_qa_person_affiliation_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_provisional_qa_person_contact_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_qa_person_contact_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  fixed_contact_id UUID;
  effective_display_name TEXT;
BEGIN
  SELECT contact_id
  INTO fixed_contact_id
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF TG_OP = 'DELETE' THEN
    IF OLD.id = fixed_contact_id THEN
      RAISE EXCEPTION 'ma_provisional_qa_person_contact_is_immutable';
    END IF;
    RETURN OLD;
  END IF;

  -- Migration 076 derives display_name from first_name and last_name in its
  -- own BEFORE trigger. PostgreSQL fires same-kind triggers by name, so this
  -- guard must derive the effective value itself instead of depending on the
  -- normalize trigger having run first.
  effective_display_name := BTRIM(CONCAT_WS(
    ' ',
    NULLIF(BTRIM(NEW.first_name), ''),
    NULLIF(BTRIM(NEW.last_name), '')
  ));

  IF (
    LOWER(BTRIM(NEW.display_name)) = 'TEST-schema-redacted-person'
    OR LOWER(effective_display_name) = 'TEST-schema-redacted-person'
    OR LOWER(BTRIM(NEW.email)) = 'TEST-schema-redacted-004'
  ) AND NEW.id IS DISTINCT FROM fixed_contact_id THEN
    RAISE EXCEPTION 'ma_provisional_qa_person_contact_identity_collision';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.id = fixed_contact_id
    AND (
      NEW.display_name IS DISTINCT FROM 'TEST-schema-redacted-person'
      OR effective_display_name IS DISTINCT FROM 'TEST-schema-redacted-person'
      OR LOWER(BTRIM(NEW.email)) IS DISTINCT FROM 'TEST-schema-redacted-005'
      OR NEW.status IS DISTINCT FROM 'active'
      OR NEW.archived_at IS NOT NULL
      OR NEW.archived_by IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'ma_provisional_qa_person_contact_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_provisional_source_context_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_source_context_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_provisional_source_context_is_immutable';
END;
$$;


--
-- Name: guard_ma_provisional_source_cutover(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_source_cutover"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ma-provisional-source-cutover-readiness', 76064)
  );
  PERFORM public.assert_ma_provisional_source_context_integrity();

  IF NEW.status IN ('approved', 'activating', 'activated')
    AND EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      WHERE public.ma_opportunity_source_review_required(opportunity.id)
    ) THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_cutover_treatment';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: guard_ma_provisional_source_review_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_ma_provisional_source_review_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  assignment_row public.ma_provisional_source_review_events%ROWTYPE;
BEGIN
  PERFORM public.assert_ma_provisional_source_context_integrity();

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF context_row.context_key IS NULL
    OR NEW.provisional_office_id <> context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_review_unknown_context';
  END IF;

  IF NEW.event_kind = 'assigned' THEN
    IF NEW.resulting_source_office_id <> context_row.office_id THEN
      RAISE EXCEPTION 'ma_provisional_source_assignment_requires_acme_office';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ma_provisional_source_review_events assignment
      WHERE assignment.opportunity_id = NEW.opportunity_id
        AND assignment.provisional_office_id = context_row.office_id
        AND assignment.event_kind = 'assigned'
        AND NOT EXISTS (
          SELECT 1
          FROM public.ma_provisional_source_review_events resolution
          WHERE resolution.event_kind = 'resolved'
            AND resolution.related_assignment_id = assignment.id
        )
    ) THEN
      RAISE EXCEPTION 'ma_provisional_source_assignment_already_unresolved';
    END IF;

    RETURN NEW;
  END IF;

  SELECT *
  INTO assignment_row
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.id = NEW.related_assignment_id
    AND assignment.event_kind = 'assigned'
  FOR KEY SHARE;

  IF assignment_row.id IS NULL
    OR assignment_row.opportunity_id <> NEW.opportunity_id
    OR assignment_row.provisional_office_id <> context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_matching_assignment';
  END IF;

  IF NEW.resulting_source_office_id = context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_real_office';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_opportunity_source_contact_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."guard_opportunity_source_contact_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id
    AND EXISTS (
      SELECT 1
      FROM public.opportunity_source_contacts legacy_link
      WHERE legacy_link.opportunity_id = OLD.id
        AND legacy_link.canonical_opportunity_contact_id IS NULL
    ) THEN
    RAISE EXCEPTION 'opportunity_source_contact_links_must_be_resolved_before_source_change';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: increment_email_count("date"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."increment_email_count"("target_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO email_daily_counts (date, count)
  VALUES (target_date, 1)
  ON CONFLICT (date)
  DO UPDATE SET count = email_daily_counts.count + 1;
END;
$$;


--
-- Name: journey_append_evidence("uuid", "public"."opportunity_pursuit_evidence_type", "text", "text", "uuid", "uuid", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_append_evidence"("p_match_id" "uuid", "p_event_type" "public"."opportunity_pursuit_evidence_type", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid" DEFAULT NULL::"uuid", "p_document_id" "uuid" DEFAULT NULL::"uuid", "p_evidence_reference" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_id UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
  INSERT INTO public.opportunity_pursuit_evidence (
    match_id, opportunity_id, repreneur_id, event_type, actor, idempotency_key,
    nda_artifact_id, document_id, evidence_reference, metadata, recorded_at
  ) VALUES (
    v_match.id, v_match.opportunity_id, v_match.repreneur_id, p_event_type, p_actor,
    p_idempotency_key, p_artifact_id, p_document_id, p_evidence_reference, COALESCE(p_metadata, '{}'::JSONB), clock_timestamp()
  ) ON CONFLICT (match_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.opportunity_pursuit_evidence
    WHERE match_id = p_match_id AND idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END; $$;


--
-- Name: journey_current_artifact_is_valid("uuid", "public"."opportunity_nda_artifact_role"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_artifact_is_valid"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
 SELECT public.journey_current_signed_validation_event(p_match_id,p_role) IS NOT NULL
$$;


--
-- Name: journey_current_cycle_event("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_cycle_event"("p_match_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT e.id FROM public.opportunity_pursuit_evidence e
  JOIN public.opportunity_matches m ON m.id=e.match_id
  WHERE e.match_id=p_match_id AND e.event_type='mutual_interest_validated'
    AND m.status='active_pursuit'
  ORDER BY recorded_at DESC, id DESC LIMIT 1
$$;


--
-- Name: journey_current_cycle_started_at("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_cycle_started_at"("p_match_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT recorded_at FROM public.opportunity_pursuit_evidence
  WHERE id=public.journey_current_cycle_event(p_match_id)
$$;


--
-- Name: journey_current_dispatch_event("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_dispatch_event"("p_match_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH gate AS (SELECT id, recorded_at, metadata FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_gate_2_event(p_match_id))
  SELECT e.id FROM public.opportunity_pursuit_evidence e, gate g
  WHERE e.match_id=p_match_id AND e.event_type='manual_package_dispatched' AND e.recorded_at>=g.recorded_at
    AND e.metadata->>'gate_2_evidence_id'=g.id::TEXT
    AND e.metadata->>'renew_artifact_id'=g.metadata->>'renew_artifact_id'
    AND e.metadata->>'repreneur_artifact_id'=g.metadata->>'repreneur_artifact_id'
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;


--
-- Name: journey_current_gate_1_event("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_gate_1_event"("p_match_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH cycle AS (SELECT public.journey_current_cycle_event(p_match_id) id),
  start AS (SELECT e.recorded_at FROM public.opportunity_pursuit_evidence e JOIN cycle c ON c.id=e.id),
  template AS (SELECT public.journey_current_template_id(p_match_id) id),
  qualification AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, start
    WHERE e.match_id=p_match_id AND e.event_type='qualification_requested' AND e.recorded_at>=start.recorded_at
  ), qualified AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, start, qualification q
    WHERE e.match_id=p_match_id AND e.event_type='intermediary_qualified' AND e.recorded_at>=start.recorded_at AND q.recorded_at IS NOT NULL AND e.recorded_at>=q.recorded_at
  ), template_validated AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, template t, qualified q
    WHERE e.match_id=p_match_id AND e.event_type='template_validated' AND e.nda_artifact_id=t.id AND q.recorded_at IS NOT NULL AND e.recorded_at>=q.recorded_at
  )
  SELECT e.id FROM public.opportunity_pursuit_evidence e, cycle c, template_validated v
  WHERE c.id IS NOT NULL AND e.match_id=p_match_id AND e.event_type='gate_1_passed'
    AND v.recorded_at IS NOT NULL AND e.recorded_at>=v.recorded_at
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;


--
-- Name: journey_current_gate_2_event("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_gate_2_event"("p_match_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH cycle AS (SELECT public.journey_current_cycle_event(p_match_id) id),
  start AS (SELECT e.recorded_at FROM public.opportunity_pursuit_evidence e JOIN cycle c ON c.id=e.id),
  renew AS (SELECT public.journey_current_signed_validation_event(p_match_id, 'renew_signed_copy') id),
  repreneur AS (SELECT public.journey_current_signed_validation_event(p_match_id, 'repreneur_signed_copy') id),
  v AS (SELECT greatest((SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=(SELECT id FROM renew)), (SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=(SELECT id FROM repreneur))) recorded_at)
  SELECT e.id FROM public.opportunity_pursuit_evidence e, cycle c, start s, renew r, repreneur rp, v
  WHERE c.id IS NOT NULL AND r.id IS NOT NULL AND rp.id IS NOT NULL AND e.match_id=p_match_id AND e.event_type='gate_2_passed'
    AND e.recorded_at>=s.recorded_at AND e.recorded_at>=v.recorded_at
    AND e.metadata->>'renew_validation_id'=r.id::TEXT AND e.metadata->>'repreneur_validation_id'=rp.id::TEXT
    AND e.metadata->>'renew_artifact_id'=(SELECT nda_artifact_id::TEXT FROM public.opportunity_pursuit_evidence WHERE id=r.id)
    AND e.metadata->>'repreneur_artifact_id'=(SELECT nda_artifact_id::TEXT FROM public.opportunity_pursuit_evidence WHERE id=rp.id)
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;


--
-- Name: journey_current_signed_validation_event("uuid", "public"."opportunity_nda_artifact_role"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_signed_validation_event"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH gate AS (SELECT id, recorded_at FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_gate_1_event(p_match_id)),
  artifact AS (
    SELECT id FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role=p_role
    ORDER BY version_number DESC LIMIT 1
  )
  SELECT e.id FROM public.opportunity_pursuit_evidence e, gate g, artifact a
  WHERE e.match_id=p_match_id AND e.nda_artifact_id=a.id AND e.recorded_at>=g.recorded_at
    AND e.event_type=CASE p_role WHEN 'renew_signed_copy' THEN 'renew_signed_copy_validated'::public.opportunity_pursuit_evidence_type ELSE 'repreneur_signed_copy_validated'::public.opportunity_pursuit_evidence_type END
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;


--
-- Name: journey_current_template_id("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_current_template_id"("p_match_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT a.id FROM public.opportunity_nda_artifacts a
  JOIN public.opportunity_matches m ON m.opportunity_id=a.opportunity_id
  WHERE m.id=p_match_id AND a.match_id IS NULL AND a.artifact_role='blank_template'
  ORDER BY a.version_number DESC LIMIT 1
$$;


--
-- Name: journey_gate_2_satisfied("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_gate_2_satisfied"("p_match_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
 SELECT public.wave_journey_is_enabled() AND public.journey_current_gate_2_event(p_match_id) IS NOT NULL
$$;


--
-- Name: journey_grant_confidential_access("uuid", "uuid", "text", "text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_grant_confidential_access"("p_match_id" "uuid", "p_information_memo_document_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_nda_expires_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE;
  v_existing UUID; v_cycle UUID; v_gate2 UUID; v_dispatch UUID; v_firm_id UUID;
  v_firm_name TEXT; v_office_id UUID; v_office_name TEXT; v_contacts JSONB; v_event UUID;
  v_grant public.opportunity_pursuit_confidential_grants%ROWTYPE;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  IF p_nda_expires_at IS NULL OR p_nda_expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'A future NDA expiry is required before confidential access.'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active') THEN RAISE EXCEPTION 'An active pursuit on an active opportunity is required.'; END IF;
  SELECT * INTO v_doc FROM public.opportunity_documents WHERE id=p_information_memo_document_id;
  v_cycle:=public.journey_current_cycle_event(p_match_id); v_gate2:=public.journey_current_gate_2_event(p_match_id); v_dispatch:=public.journey_current_dispatch_event(p_match_id);
  IF v_cycle IS NULL OR v_gate2 IS NULL OR v_dispatch IS NULL THEN RAISE EXCEPTION 'Current Gate 2 and its exact manual dispatch are required before confidential access.'; END IF;
  IF v_doc.id IS NULL
    OR v_doc.opportunity_id<>v_match.opportunity_id
    OR v_doc.document_type<>'deal_book'
    OR v_doc.visibility<>'staff_only'
    OR v_doc.external_url IS NOT NULL
    OR COALESCE(v_doc.storage_bucket,'opportunity-documents')<>'opportunity-documents'
    OR NULLIF(BTRIM(v_doc.storage_path),'') IS NULL
    OR v_doc.storage_path NOT LIKE v_match.opportunity_id::TEXT||'/%'
    OR LOWER(COALESCE(v_doc.file_name,'')) NOT LIKE '%.pdf'
  THEN RAISE EXCEPTION 'Select a retained staff-only PDF Information Memorandum for this opportunity.'; END IF;
  SELECT f.id,f.name,o.id,o.name INTO v_firm_id,v_firm_name,v_office_id,v_office_name FROM public.opportunities p JOIN public.ma_offices o ON o.id=p.source_office_id JOIN public.ma_firms f ON f.id=o.firm_id WHERE p.id=v_match.opportunity_id AND o.status='active' AND f.status<>'archived';
  IF v_office_id IS NULL THEN RAISE EXCEPTION 'An active canonical source office is required before disclosure.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name',link.contact_name_snapshot) ORDER BY link.is_primary DESC,link.linked_at),'[]'::JSONB) INTO v_contacts FROM public.opportunity_ma_contacts link JOIN public.ma_contact_office_affiliations a ON a.id=link.affiliation_id WHERE link.opportunity_id=v_match.opportunity_id AND link.is_active AND a.office_id=v_office_id AND NULLIF(BTRIM(link.contact_name_snapshot),'') IS NOT NULL;
  IF jsonb_array_length(v_contacts)=0 THEN RAISE EXCEPTION 'An approved source contact is required before disclosure.'; END IF;
  SELECT * INTO v_grant FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id FOR UPDATE;
  IF v_grant.id IS NOT NULL AND v_grant.revoked_at IS NULL
    AND v_grant.cycle_started_evidence_id=v_cycle AND v_grant.gate_2_evidence_id=v_gate2 AND v_grant.dispatch_evidence_id=v_dispatch THEN
    IF v_grant.information_memo_document_id=p_information_memo_document_id AND v_grant.nda_expires_at=p_nda_expires_at THEN
      SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='confidential_access_granted' AND metadata->>'cycle_started_evidence_id'=v_cycle::TEXT AND metadata->>'gate_2_evidence_id'=v_gate2::TEXT AND metadata->>'dispatch_evidence_id'=v_dispatch::TEXT ORDER BY recorded_at DESC,id DESC LIMIT 1;
      IF v_event IS NULL THEN RAISE EXCEPTION 'Live grant lacks its immutable disclosure evidence.'; END IF;
      RETURN v_event;
    END IF;
    RAISE EXCEPTION 'Confidential access is already live for this pursuit. Revoke it before changing the disclosure.';
  END IF;
  INSERT INTO public.opportunity_pursuit_confidential_grants(match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,disclosed_contacts,granted_by,cycle_started_evidence_id,gate_2_evidence_id,dispatch_evidence_id,nda_expires_at)
  VALUES(v_match.id,v_match.opportunity_id,v_doc.id,v_firm_id,v_firm_name,v_office_id,v_office_name,v_contacts,p_actor,v_cycle,v_gate2,v_dispatch,p_nda_expires_at)
  ON CONFLICT(match_id) DO UPDATE SET information_memo_document_id=EXCLUDED.information_memo_document_id,source_firm_id=EXCLUDED.source_firm_id,source_firm_name=EXCLUDED.source_firm_name,source_office_id=EXCLUDED.source_office_id,source_office_name=EXCLUDED.source_office_name,disclosed_contacts=EXCLUDED.disclosed_contacts,source_disclosed_at=clock_timestamp(),granted_by=EXCLUDED.granted_by,cycle_started_evidence_id=EXCLUDED.cycle_started_evidence_id,gate_2_evidence_id=EXCLUDED.gate_2_evidence_id,dispatch_evidence_id=EXCLUDED.dispatch_evidence_id,nda_expires_at=EXCLUDED.nda_expires_at,revoked_at=NULL,revoked_by=NULL,revoked_reason=NULL;
  v_event:=public.journey_append_evidence(p_match_id,'confidential_access_granted',p_actor,p_idempotency_key,NULL,v_doc.id,NULL,jsonb_build_object('cycle_started_evidence_id',v_cycle,'gate_2_evidence_id',v_gate2,'dispatch_evidence_id',v_dispatch,'information_memo_document_id',v_doc.id,'source_firm_name',v_firm_name,'source_office_name',v_office_name,'contact_names',v_contacts,'nda_expires_at',p_nda_expires_at));
  RETURN v_event;
END $$;


--
-- Name: journey_record_evidence("uuid", "text", "text", "text", "uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_record_evidence"("p_match_id" "uuid", "p_event_type" "text", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid" DEFAULT NULL::"uuid", "p_document_id" "uuid" DEFAULT NULL::"uuid", "p_evidence_reference" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_type public.opportunity_pursuit_evidence_type:=p_event_type::public.opportunity_pursuit_evidence_type;
  v_match public.opportunity_matches%ROWTYPE; v_cycle UUID; v_start TIMESTAMPTZ; v_template UUID;
  v_artifact public.opportunity_nda_artifacts%ROWTYPE; v_gate1 UUID; v_renew_validation UUID; v_repreneur_validation UUID;
  v_gate2 UUID; v_existing UUID; v_metadata JSONB:='{}'::JSONB;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit' THEN RAISE EXCEPTION 'An active pursuit is required.'; END IF;
  v_cycle:=public.journey_current_cycle_event(p_match_id); v_start:=public.journey_current_cycle_started_at(p_match_id);
  IF v_cycle IS NULL THEN RAISE EXCEPTION 'Recorded mutual interest is required.'; END IF;
  IF v_type='qualification_requested' THEN NULL;
  ELSIF v_type='intermediary_qualified' THEN
    IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='qualification_requested' AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Intermediary qualification requires this cycle qualification request.'; END IF;
  ELSIF v_type='template_validated' THEN
    v_template:=public.journey_current_template_id(p_match_id);
    IF p_artifact_id IS NULL OR v_template IS NULL OR p_artifact_id IS DISTINCT FROM v_template OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='intermediary_qualified' AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Template validation requires current-cycle qualification and the exact current blank template.'; END IF;
  ELSIF v_type='gate_1_passed' THEN
    IF public.journey_current_gate_1_event(p_match_id) IS NOT NULL THEN RAISE EXCEPTION 'Current Gate 1 is already recorded.'; END IF;
    v_template:=public.journey_current_template_id(p_match_id);
    IF v_template IS NULL OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='template_validated' AND nda_artifact_id=v_template AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Gate 1 requires this cycle qualification and exact current-template validation.'; END IF;
  ELSIF v_type IN ('renew_signed_copy_validated','repreneur_signed_copy_validated') THEN
    v_gate1:=public.journey_current_gate_1_event(p_match_id);
    SELECT * INTO v_artifact FROM public.opportunity_nda_artifacts WHERE id=p_artifact_id;
    IF v_gate1 IS NULL OR v_artifact.id IS NULL OR v_artifact.match_id<>p_match_id
      OR v_artifact.artifact_role <> (CASE WHEN v_type='renew_signed_copy_validated' THEN 'renew_signed_copy'::public.opportunity_nda_artifact_role ELSE 'repreneur_signed_copy'::public.opportunity_nda_artifact_role END)
      OR EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts n WHERE n.match_id=p_match_id AND n.artifact_role=v_artifact.artifact_role AND n.version_number>v_artifact.version_number)
      OR v_artifact.recorded_at < (SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=v_gate1)
    THEN RAISE EXCEPTION 'Validation requires the exact current signed copy uploaded after current Gate 1.'; END IF;
  ELSIF v_type='gate_2_passed' THEN
    v_renew_validation:=public.journey_current_signed_validation_event(p_match_id,'renew_signed_copy'); v_repreneur_validation:=public.journey_current_signed_validation_event(p_match_id,'repreneur_signed_copy');
    IF v_renew_validation IS NULL OR v_repreneur_validation IS NULL THEN RAISE EXCEPTION 'Gate 2 requires current signed copies validated after Gate 1.'; END IF;
    v_metadata:=jsonb_build_object('renew_validation_id',v_renew_validation,'repreneur_validation_id',v_repreneur_validation,'renew_artifact_id',(SELECT nda_artifact_id FROM public.opportunity_pursuit_evidence WHERE id=v_renew_validation),'repreneur_artifact_id',(SELECT nda_artifact_id FROM public.opportunity_pursuit_evidence WHERE id=v_repreneur_validation));
  ELSIF v_type='manual_package_dispatched' THEN
    v_gate2:=public.journey_current_gate_2_event(p_match_id);
    IF v_gate2 IS NULL THEN RAISE EXCEPTION 'Manual dispatch requires exact current Gate 2.'; END IF;
    v_metadata:=jsonb_build_object('gate_2_evidence_id',v_gate2,'renew_artifact_id',(SELECT metadata->>'renew_artifact_id' FROM public.opportunity_pursuit_evidence WHERE id=v_gate2),'repreneur_artifact_id',(SELECT metadata->>'repreneur_artifact_id' FROM public.opportunity_pursuit_evidence WHERE id=v_gate2));
  ELSE RAISE EXCEPTION 'This evidence type is not a staff journey action.';
  END IF;
  RETURN public.journey_append_evidence(p_match_id,v_type,p_actor,p_idempotency_key,p_artifact_id,p_document_id,p_evidence_reference,v_metadata);
END $$;


--
-- Name: journey_repreneur_authorized_template("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_repreneur_authorized_template"("p_match_id" "uuid", "p_repreneur_id" "uuid") RETURNS TABLE("document_id" "uuid", "storage_bucket" "text", "storage_path" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT d.id, d.storage_bucket, d.storage_path
  FROM public.wave_journey_settings settings
  JOIN public.opportunity_matches match ON match.id=p_match_id
  JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id
  JOIN public.opportunity_nda_artifacts artifact ON artifact.id=public.journey_current_template_id(match.id)
  JOIN public.opportunity_documents d ON d.id=artifact.document_id
  WHERE settings.singleton=TRUE AND settings.enabled=TRUE
    AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit' AND opportunity.status='active'
    AND public.journey_current_gate_1_event(match.id) IS NOT NULL
    AND artifact.opportunity_id=match.opportunity_id AND artifact.match_id IS NULL AND artifact.artifact_role='blank_template'
    AND d.opportunity_id=match.opportunity_id AND d.document_type='nda' AND d.visibility='staff_only'
    AND d.external_url IS NULL AND d.storage_bucket='opportunity-documents'
    AND d.storage_path LIKE match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%'
    AND (
      (LOWER(COALESCE(d.file_name,'')) LIKE '%.pdf' AND LOWER(COALESCE(d.mime_type,''))='application/pdf')
      OR (
        LOWER(COALESCE(d.file_name,'')) LIKE '%.docx'
        AND LOWER(COALESCE(d.mime_type,''))='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    )
    AND COALESCE(d.size_bytes,0)>0
  LIMIT 1
$$;


--
-- Name: journey_repreneur_can_access_confidential("uuid", "uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_repreneur_can_access_confidential"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_document_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
 SELECT public.wave_journey_is_enabled() AND EXISTS(
  SELECT 1 FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id
  WHERE m.id=p_match_id AND m.repreneur_id=p_repreneur_id AND m.status='active_pursuit' AND o.status='active'
   AND g.information_memo_document_id=p_document_id AND g.revoked_at IS NULL AND g.nda_expires_at>NOW()
   AND g.cycle_started_evidence_id=public.journey_current_cycle_event(m.id)
   AND g.gate_2_evidence_id=public.journey_current_gate_2_event(m.id)
   AND g.dispatch_evidence_id=public.journey_current_dispatch_event(m.id)
 )
$$;


--
-- Name: journey_revoke_confidential_access("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_revoke_confidential_access"("p_match_id" "uuid", "p_actor" "text", "p_reason" "text", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_event UUID; BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key; IF v_event IS NOT NULL THEN RETURN v_event; END IF;
 UPDATE public.opportunity_pursuit_confidential_grants SET revoked_at=NOW(),revoked_by=p_actor,revoked_reason=NULLIF(BTRIM(p_reason),'') WHERE match_id=p_match_id AND revoked_at IS NULL;
 RETURN public.journey_append_evidence(p_match_id,'access_revoked',p_actor,p_idempotency_key,NULL,NULL,p_reason,jsonb_build_object('cycle_started_evidence_id',public.journey_current_cycle_event(p_match_id)));
END $$;


--
-- Name: journey_start_pursuit("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_start_pursuit"("p_match_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_evidence_reference" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status <> 'interested' THEN RAISE EXCEPTION 'Only an interested match can start a pursuit.'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active opportunity can start a pursuit.'; END IF;
  UPDATE public.opportunity_matches SET status='active_pursuit', pursuit_stage='interest', pursuit_stage_updated_by=p_actor, pursuit_stage_updated_at=NOW(), reviewed_by=p_actor, reviewed_at=NOW() WHERE id=p_match_id;
  RETURN public.journey_append_evidence(p_match_id, 'mutual_interest_validated', p_actor, p_idempotency_key, NULL, NULL, p_evidence_reference);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This opportunity already has an active pursuit.'; END; $$;


--
-- Name: journey_submit_repreneur_signed_copy("uuid", "uuid", "text", "text", "text", "text", bigint, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_submit_repreneur_signed_copy"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text") RETURNS TABLE("artifact_id" "uuid", "document_id" "uuid", "version_number" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_email TEXT; v_gate UUID; v_prior UUID; v_version INTEGER; v_document UUID; v_artifact UUID; BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE; SELECT LOWER(BTRIM(email)) INTO v_email FROM public.repreneurs WHERE id=p_repreneur_id;
 IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR v_match.repreneur_id<>p_repreneur_id OR v_email IS NULL OR v_email<>LOWER(BTRIM(p_actor_email)) THEN RAISE EXCEPTION 'Only the active pursuit repreneur may submit this signed copy.'; END IF;
 v_gate:=public.journey_current_gate_1_event(p_match_id); IF v_gate IS NULL THEN RAISE EXCEPTION 'Current Gate 1 is required before signed-copy submission.'; END IF;
 IF NULLIF(BTRIM(p_title),'') IS NULL OR NULLIF(BTRIM(p_storage_path),'') IS NULL OR LOWER(p_file_name) NOT LIKE '%.pdf' OR p_file_size<=0 OR LOWER(p_content_sha256)!~'^[0-9a-f]{64}$' OR p_storage_path NOT LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/repreneur_signed_copy/%' THEN RAISE EXCEPTION 'Submit one retained PDF in the canonical signed-copy path.'; END IF;
 SELECT a.id,a.version_number INTO v_artifact,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1;
 IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,(SELECT a.document_id FROM public.opportunity_nda_artifacts a WHERE a.id=v_artifact),v_version; RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_match_id::TEXT||':repreneur_signed_copy',0));
 SELECT a.id,a.document_id,a.version_number INTO v_artifact,v_document,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1;
 IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,v_document,v_version; RETURN; END IF;
 SELECT a.id,a.version_number+1 INTO v_prior,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' ORDER BY a.version_number DESC LIMIT 1; v_version:=COALESCE(v_version,1);
 INSERT INTO public.opportunity_documents(opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,size_bytes,mime_type,uploaded_by) VALUES(v_match.opportunity_id,p_title,'nda','staff_only','opportunity-documents',p_storage_path,p_file_name,p_file_size,'application/pdf',p_actor_email) RETURNING id INTO v_document;
 PERFORM set_config('wave.journey_portal_repreneur_upload','on',true);
 INSERT INTO public.opportunity_nda_artifacts(opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,supersedes_artifact_id,recorded_by,recorded_at) VALUES(v_match.opportunity_id,p_match_id,v_document,'repreneur_signed_copy',v_version,LOWER(p_content_sha256),v_prior,p_actor_email,clock_timestamp()) RETURNING id INTO v_artifact;
 RETURN QUERY SELECT v_artifact,v_document,v_version;
EXCEPTION WHEN unique_violation THEN
 SELECT a.id,a.document_id,a.version_number INTO v_artifact,v_document,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1;
 IF v_artifact IS NULL THEN RAISE; END IF; RETURN QUERY SELECT v_artifact,v_document,v_version;
END $_$;


--
-- Name: journey_submit_repreneur_signed_copy_v2("uuid", "uuid", "text", "text", "text", "text", bigint, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_submit_repreneur_signed_copy_v2"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text") RETURNS TABLE("artifact_id" "uuid", "document_id" "uuid", "version_number" integer, "reused_existing" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE r RECORD; v_path TEXT; BEGIN
 -- The core authorizes ownership and current Gate 1 before it may reuse a
 -- content-hash match; hashes are never an artifact-discovery side channel.
 SELECT * INTO r FROM public.journey_submit_repreneur_signed_copy(p_match_id,p_repreneur_id,p_actor_email,p_title,p_storage_path,p_file_name,p_file_size,p_content_sha256);
 SELECT storage_path INTO v_path FROM public.opportunity_documents WHERE id=r.document_id;
 RETURN QUERY SELECT r.artifact_id,r.document_id,r.version_number,v_path IS DISTINCT FROM p_storage_path;
END $$;


--
-- Name: journey_transition_terminal("uuid", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."journey_transition_terminal"("p_match_id" "uuid", "p_transition" "text", "p_actor" "text", "p_idempotency_key" "text", "p_closure_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_event UUID; BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key; IF v_event IS NOT NULL THEN RETURN v_event; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE; IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
 IF p_transition='continue' THEN IF v_match.status<>'active_pursuit' OR NOT public.journey_repreneur_can_access_confidential(p_match_id,v_match.repreneur_id,(SELECT information_memo_document_id FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id)) THEN RAISE EXCEPTION 'Continue requires a live current confidential grant.'; END IF; RETURN public.journey_append_evidence(p_match_id,'continued',p_actor,p_idempotency_key); END IF;
 IF p_transition='drop' THEN IF v_match.status<>'active_pursuit' THEN RAISE EXCEPTION 'Only an active pursuit can be dropped.'; END IF; PERFORM public.journey_revoke_confidential_access(p_match_id,p_actor,'dropped',p_idempotency_key||':revoke'); UPDATE public.opportunity_matches SET status='dropped',pursuit_stage='dropped',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW() WHERE id=p_match_id; RETURN public.journey_append_evidence(p_match_id,'dropped',p_actor,p_idempotency_key); END IF;
 IF p_transition='complete' THEN IF v_match.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='continued' AND recorded_at>=public.journey_current_cycle_started_at(p_match_id)) THEN RAISE EXCEPTION 'Complete requires current continued external follow-up.'; END IF; PERFORM public.journey_revoke_confidential_access(p_match_id,p_actor,'completed',p_idempotency_key||':revoke'); UPDATE public.opportunity_matches SET status='completed',pursuit_stage='closed',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW() WHERE id=p_match_id; PERFORM set_config('wave.journey_terminal_transition','on',true); UPDATE public.opportunities SET status='closed',updated_by=p_actor WHERE id=v_match.opportunity_id; INSERT INTO public.opportunity_closure_history(opportunity_id,reason,closed_by) VALUES(v_match.opportunity_id,'signed_repreneur'::public.opportunity_closure_reason,p_actor); RETURN public.journey_append_evidence(p_match_id,'completed',p_actor,p_idempotency_key,NULL,NULL,p_closure_reason); END IF;
 IF p_transition='reopen' THEN IF v_match.status<>'dropped' THEN RAISE EXCEPTION 'Only a dropped pursuit can reopen.'; END IF; UPDATE public.opportunity_matches SET status='interested',pursuit_stage=NULL,pursuit_stage_notes=NULL,pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW() WHERE id=p_match_id; RETURN public.journey_append_evidence(p_match_id,'reopened',p_actor,p_idempotency_key); END IF;
 RAISE EXCEPTION 'Unsupported pursuit transition.';
END $$;


--
-- Name: ma_contact_email_address_is_suppressed("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_contact_email_address_is_suppressed"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    NULLIF(BTRIM(p_email), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.ma_contacts contact
      WHERE contact.campaign_email_suppressed
        AND LOWER(BTRIM(contact.email)) = LOWER(BTRIM(p_email))
    );
$$;


--
-- Name: ma_contact_email_is_allowed("uuid", "uuid", "public"."ma_contact_email_purpose"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_contact_email_is_allowed"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
  has_active_link BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO contact_row
  FROM public.ma_contacts
  WHERE id = p_contact_id;

  IF NOT FOUND OR contact_row.status <> 'active' THEN
    RETURN FALSE;
  END IF;

  IF p_purpose IN (
    'opportunity_general'::public.ma_contact_email_purpose,
    'opportunity_nda_request'::public.ma_contact_email_purpose
  ) THEN
    IF p_opportunity_id IS NULL THEN
      RETURN FALSE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.id = link.affiliation_id
      WHERE link.opportunity_id = p_opportunity_id
        AND affiliation.contact_id = p_contact_id
        AND link.is_active
        AND link.removed_at IS NULL
        AND affiliation.is_active
        AND affiliation.ended_at IS NULL
    )
    INTO has_active_link;

    IF NOT has_active_link THEN
      RETURN FALSE;
    END IF;
  ELSIF p_opportunity_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT contact_row.campaign_email_suppressed THEN
    RETURN TRUE;
  END IF;

  RETURN p_purpose =
    'opportunity_nda_request'::public.ma_contact_email_purpose;
END
$$;


--
-- Name: ma_cutover_activation_guard_present("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_activation_guard_present"("p_run_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  guard_present BOOLEAN;
BEGIN
  IF pg_catalog.to_regclass('pg_temp.ma_cutover_activation_guard') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE
    'SELECT EXISTS (SELECT 1 FROM pg_temp.ma_cutover_activation_guard WHERE run_id = $1)'
  INTO guard_present
  USING p_run_id;

  RETURN COALESCE(guard_present, FALSE);
END;
$_$;


--
-- Name: ma_cutover_aggregate_value_is_sanitized("jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_aggregate_value_is_sanitized"("p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
  child JSONB;
BEGIN
  CASE JSONB_TYPEOF(p_value)
    WHEN 'null', 'boolean', 'number' THEN
      RETURN TRUE;
    WHEN 'array' THEN
      FOR child IN SELECT value FROM JSONB_ARRAY_ELEMENTS(p_value)
      LOOP
        IF NOT public.ma_cutover_aggregate_value_is_sanitized(child) THEN
          RETURN FALSE;
        END IF;
      END LOOP;
      RETURN TRUE;
    WHEN 'object' THEN
      FOR child IN SELECT value FROM JSONB_EACH(p_value)
      LOOP
        IF NOT public.ma_cutover_aggregate_value_is_sanitized(child) THEN
          RETURN FALSE;
        END IF;
      END LOOP;
      RETURN TRUE;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;


--
-- Name: ma_cutover_bounded_flat_object("jsonb", "text"[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_bounded_flat_object"("p_value" "jsonb", "p_allowed_keys" "text"[], "p_max_bytes" integer, "p_max_string_chars" integer) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
  field RECORD;
BEGIN
  IF JSONB_TYPEOF(p_value) <> 'object'
    OR pg_column_size(p_value) > p_max_bytes THEN
    RETURN FALSE;
  END IF;

  FOR field IN SELECT key, value FROM JSONB_EACH(p_value)
  LOOP
    IF NOT (field.key = ANY(p_allowed_keys))
      OR JSONB_TYPEOF(field.value) NOT IN ('string', 'number', 'boolean', 'null') THEN
      RETURN FALSE;
    END IF;

    IF JSONB_TYPEOF(field.value) = 'string'
      AND CHAR_LENGTH(field.value #>> '{}') > p_max_string_chars THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;


--
-- Name: ma_cutover_locator_is_sanitized("jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_locator_is_sanitized"("p_locator" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT public.ma_cutover_bounded_flat_object(
    p_locator,
    ARRAY[
      'sourceWorkbookId', 'sourceSheet', 'sourceRow', 'sourceKey',
      'sourceRowId', 'sheet', 'row', 'rowNumber'
    ]::TEXT[],
    1024,
    256
  );
$$;


--
-- Name: ma_cutover_payload_is_sanitized("text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_payload_is_sanitized"("p_entity_kind" "text", "p_payload" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
  allowed_keys TEXT[];
BEGIN
  allowed_keys := CASE p_entity_kind
    WHEN 'firm' THEN ARRAY[
      'name', 'category', 'networkLabel', 'websiteUrl', 'internalNotes'
    ]::TEXT[]
    WHEN 'office' THEN ARRAY[
      'name', 'isSyntheticDefault', 'city', 'internalNotes'
    ]::TEXT[]
    WHEN 'contact' THEN ARRAY[
      'firstName', 'lastName', 'email', 'phone'
    ]::TEXT[]
    WHEN 'affiliation' THEN ARRAY['jobTitle']::TEXT[]
    WHEN 'opportunity' THEN ARRAY[
      'reference', 'description', 'targetStatus',
      'primaryAffiliationTemporaryId', 'sector', 'activity', 'location',
      'locationDecision', 'sourceGeographyLabel', 'geographyDecision',
      'revenueMeur', 'ebitdaKeur', 'headcount', 'headcountRange',
      'dateAdded', 'publicTitle', 'teaserSummary', 'internalNotes'
    ]::TEXT[]
    ELSE NULL
  END;

  IF allowed_keys IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.ma_cutover_bounded_flat_object(
    p_payload,
    allowed_keys,
    8192,
    2048
  );
END;
$$;


--
-- Name: ma_cutover_reconciliation_is_sanitized("jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_reconciliation_is_sanitized"("p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
  field RECORD;
BEGIN
  IF JSONB_TYPEOF(p_value) <> 'object' OR pg_column_size(p_value) > 4096 THEN
    RETURN FALSE;
  END IF;

  FOR field IN SELECT key, value FROM JSONB_EACH(p_value)
  LOOP
    IF field.key NOT IN (
      'source_rows', 'resolved_mappings', 'opportunity_rows', 'issues',
      'geography', 'normalization'
    ) OR NOT public.ma_cutover_aggregate_value_is_sanitized(field.value) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;


--
-- Name: ma_cutover_related_ids_are_bounded("jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_related_ids_are_bounded"("p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $_$
DECLARE
  element JSONB;
BEGIN
  IF JSONB_TYPEOF(p_value) <> 'array'
    OR pg_column_size(p_value) > 4096 THEN
    RETURN FALSE;
  END IF;

  IF JSONB_ARRAY_LENGTH(p_value) > 64 THEN
    RETURN FALSE;
  END IF;

  FOR element IN SELECT value FROM JSONB_ARRAY_ELEMENTS(p_value)
  LOOP
    IF JSONB_TYPEOF(element) <> 'string'
      OR CHAR_LENGTH(element #>> '{}') > 160
      OR element #>> '{}' !~ '^[A-Za-z0-9][-A-Za-z0-9._:/@+]{0,159}$' THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$_$;


--
-- Name: ma_cutover_result_is_sanitized("jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_result_is_sanitized"("p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
  field RECORD;
BEGIN
  IF JSONB_TYPEOF(p_value) <> 'object' OR pg_column_size(p_value) > 1024 THEN
    RETURN FALSE;
  END IF;

  FOR field IN SELECT key, value FROM JSONB_EACH(p_value)
  LOOP
    IF field.key NOT IN (
      'firms_mapped', 'offices_mapped', 'contacts_mapped',
      'affiliations_mapped', 'opportunities_created', 'staging_purged'
    ) OR NOT public.ma_cutover_aggregate_value_is_sanitized(field.value) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;


--
-- Name: ma_cutover_review_decisions_are_sanitized("jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_review_decisions_are_sanitized"("p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
DECLARE
  field RECORD;
  approved_field JSONB;
BEGIN
  IF JSONB_TYPEOF(p_value) <> 'object' OR pg_column_size(p_value) > 4096 THEN
    RETURN FALSE;
  END IF;

  FOR field IN SELECT key, value FROM JSONB_EACH(p_value)
  LOOP
    IF field.key NOT IN (
      'approved_opportunity_fields', 'geography_decision_counts',
      'exception_resolution_counts', 'resolution_counts'
    ) THEN
      RETURN FALSE;
    END IF;

    IF field.key = 'approved_opportunity_fields' THEN
      IF JSONB_TYPEOF(field.value) <> 'array' THEN
        RETURN FALSE;
      END IF;
      IF JSONB_ARRAY_LENGTH(field.value) > 11 THEN
        RETURN FALSE;
      END IF;
      FOR approved_field IN SELECT value FROM JSONB_ARRAY_ELEMENTS(field.value)
      LOOP
        IF JSONB_TYPEOF(approved_field) <> 'string'
          OR approved_field #>> '{}' NOT IN (
            'sector', 'activity', 'location', 'revenue_meur', 'ebitda_keur',
            'headcount', 'headcount_range', 'date_added', 'public_title',
            'teaser_summary', 'internal_notes'
          ) THEN
          RETURN FALSE;
        END IF;
      END LOOP;
    ELSIF NOT public.ma_cutover_aggregate_value_is_sanitized(field.value) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;


--
-- Name: ma_cutover_supersession_guard_present("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_cutover_supersession_guard_present"("p_run_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  guard_present BOOLEAN;
BEGIN
  IF pg_catalog.to_regclass('pg_temp.ma_cutover_supersession_guard') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE
    'SELECT EXISTS (SELECT 1 FROM pg_temp.ma_cutover_supersession_guard WHERE run_id = $1)'
  INTO guard_present
  USING p_run_id;

  RETURN COALESCE(guard_present, FALSE);
END;
$_$;


--
-- Name: ma_opportunity_contact_snapshot("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_opportunity_contact_snapshot"("p_opportunity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'opportunity_contact_id', link.id,
        'affiliation_id', affiliation.id,
        'contact_id', contact.id,
        'contact_name', link.contact_name_snapshot,
        'contact_email', link.contact_email_snapshot,
        'contact_phone', link.contact_phone_snapshot,
        'is_primary', link.is_primary
      )
      ORDER BY link.id
    ) FILTER (WHERE link.id IS NOT NULL),
    '[]'::JSONB
  )
  FROM public.opportunities opportunity
  LEFT JOIN public.opportunity_ma_contacts link
    ON link.opportunity_id = opportunity.id
    AND link.is_active
  LEFT JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
  LEFT JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE opportunity.id = p_opportunity_id;
$$;


--
-- Name: ma_opportunity_source_review_required("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_opportunity_source_review_required"("p_opportunity_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM public.assert_ma_provisional_source_context_integrity();

  RETURN EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_contexts context
    JOIN public.opportunities opportunity ON opportunity.id = p_opportunity_id
    WHERE context.context_key = 'acme_co_paris'
      AND opportunity.source_office_id = context.office_id
  ) OR EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_review_events assignment
    JOIN public.ma_provisional_source_contexts context
      ON context.context_key = 'acme_co_paris'
      AND context.office_id = assignment.provisional_office_id
    WHERE assignment.opportunity_id = p_opportunity_id
      AND assignment.event_kind = 'assigned'
      AND NOT EXISTS (
        SELECT 1
        FROM public.ma_provisional_source_review_events resolution
        WHERE resolution.event_kind = 'resolved'
          AND resolution.related_assignment_id = assignment.id
      )
  );
END;
$$;


--
-- Name: ma_opportunity_source_snapshot("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ma_opportunity_source_snapshot"("p_opportunity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT jsonb_build_object(
    'source_office_id', opportunity.source_office_id,
    'office_name', office.name,
    'firm_id', firm.id,
    'firm_name', firm.name
  )
  FROM public.opportunities opportunity
  LEFT JOIN public.ma_offices office ON office.id = opportunity.source_office_id
  LEFT JOIN public.ma_firms firm ON firm.id = office.firm_id
  WHERE opportunity.id = p_opportunity_id;
$$;


--
-- Name: move_external_pursuit_stage("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."move_external_pursuit_stage"("p_dossier_id" "uuid", "p_stage" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE dossier public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_stage), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'External Pursuit stage and idempotency key are required.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF dossier.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.external_pursuit_audit_events audit
    WHERE audit.external_pursuit_id = p_dossier_id AND audit.event_type = 'updated'
      AND audit.actor_user_id = actor AND audit.idempotency_key = p_idempotency_key
  ) THEN RETURN; END IF;
  UPDATE public.external_pursuits
    SET stage = NULLIF(BTRIM(p_stage), '')::public.external_pursuit_stage,
        updated_by = actor, updated_at = clock_timestamp()
    WHERE external_pursuits.id = p_dossier_id;
  PERFORM public.external_pursuit_append_audit(
    p_dossier_id, 'updated', actor, p_idempotency_key,
    jsonb_build_object('field', 'stage', 'stage', p_stage)
  );
END $$;


--
-- Name: ma_source_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_source_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "legacy_source_id" "uuid",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "canonical_contact_id" "uuid",
    "office_affiliation_id" "uuid",
    CONSTRAINT "ma_source_contacts_check" CHECK (((NULLIF("btrim"("name"), ''::"text") IS NOT NULL) OR (NULLIF("btrim"("email"), ''::"text") IS NOT NULL) OR (NULLIF("btrim"("phone"), ''::"text") IS NOT NULL)))
);


--
-- Name: move_ma_source_contact("uuid", "uuid", "uuid", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."move_ma_source_contact"("p_contact_id" "uuid", "p_expected_source_id" "uuid", "p_new_source_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_moved_by" "text") RETURNS "public"."ma_source_contacts"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  current_contact public.ma_source_contacts%ROWTYPE;
  updated_contact public.ma_source_contacts%ROWTYPE;
BEGIN
  SELECT *
  INTO current_contact
  FROM public.ma_source_contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF current_contact.id IS NULL THEN
    RAISE EXCEPTION 'ma_source_contact_not_found';
  END IF;

  IF current_contact.source_id <> p_expected_source_id THEN
    RAISE EXCEPTION 'ma_source_contact_changed_since_loaded';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ma_sources WHERE id = p_new_source_id) THEN
    RAISE EXCEPTION 'ma_source_target_firm_not_found';
  END IF;

  IF p_name IS NOT DISTINCT FROM current_contact.name
    AND p_email IS NOT DISTINCT FROM current_contact.email
    AND p_phone IS NOT DISTINCT FROM current_contact.phone
    AND p_new_source_id = current_contact.source_id THEN
    RETURN current_contact;
  END IF;

  INSERT INTO public.ma_source_contact_moves (
    contact_id,
    old_source_id,
    new_source_id,
    old_name,
    new_name,
    old_email,
    new_email,
    old_phone,
    new_phone,
    moved_by
  ) VALUES (
    current_contact.id,
    current_contact.source_id,
    p_new_source_id,
    current_contact.name,
    p_name,
    current_contact.email,
    p_email,
    current_contact.phone,
    p_phone,
    p_moved_by
  );

  UPDATE public.ma_source_contacts
  SET
    source_id = p_new_source_id,
    name = p_name,
    email = p_email,
    phone = p_phone
  WHERE id = current_contact.id
  RETURNING * INTO updated_contact;

  RETURN updated_contact;
END;
$$;


--
-- Name: normalize_ma_contact_display_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."normalize_ma_contact_display_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.first_name := NULLIF(BTRIM(NEW.first_name), '');
  NEW.last_name := NULLIF(BTRIM(NEW.last_name), '');

  IF NEW.first_name IS NULL AND NEW.last_name IS NULL THEN
    RAISE EXCEPTION 'ma_contact_requires_name_component';
  END IF;

  NEW.display_name := BTRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name));
  RETURN NEW;
END;
$$;


--
-- Name: pdr_convert_proposal("uuid", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."pdr_convert_proposal"("p_proposal_id" "uuid", "p_conversion_token" "uuid", "p_status_override" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_proposal public.pdr_proposals%rowtype;
  v_old_card public.pdr_work_cards%rowtype;
  v_bundle_id uuid;
  v_card_id uuid;
  v_status text;
  v_title text;
  v_notes text;
  v_attachments jsonb;
begin
  select * into v_proposal
  from public.pdr_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found.';
  end if;

  if v_proposal.conversion_token <> p_conversion_token then
    raise exception 'Invalid conversion link.';
  end if;

  if v_proposal.status = 'converted' then
    select id into v_card_id
    from public.pdr_work_cards
    where source_proposal_id = v_proposal.id;
    return jsonb_build_object('work_card_id', v_card_id, 'already_converted', true);
  end if;

  if v_proposal.status not in ('ready_for_review', 'approved_problem') then
    raise exception 'This proposal is not ready for approval.';
  end if;

  if v_proposal.strategic_placement = 'orphan' then
    select r.id into v_bundle_id
    from public.pdr_requests r
    join public.pdr_milestones m on m.id = r.milestone_id
    where m.is_orphan = true and r.title = 'Unclassified work'
    limit 1;
  elsif v_proposal.strategic_placement = 'new_bundle' then
    if nullif(trim(v_proposal.suggested_bundle_title), '') is null
       or v_proposal.suggested_goal_id is null
       or v_proposal.suggested_milestone_id is null then
      raise exception 'A new bundle needs a title, goal and outcome milestone.';
    end if;

    insert into public.pdr_requests (
      title, description, goal_id, milestone_id, evidence_text, metric_text,
      smallest_version, status, challenge_score, challenge_prompts, created_by,
      decision_note, priority
    ) values (
      left(trim(v_proposal.suggested_bundle_title), 140),
      left(coalesce(nullif(v_proposal.desired_outcome, ''), v_proposal.problem_statement), 4000),
      v_proposal.suggested_goal_id,
      v_proposal.suggested_milestone_id,
      left(v_proposal.impact, 2000),
      left(v_proposal.success_signal, 1000),
      left(v_proposal.desired_outcome, 2000),
      'accepted',
      4,
      '[]'::jsonb,
      'AI proposal approved by Ivan',
      'Created atomically from proposal ' || v_proposal.id::text,
      'next'
    ) returning id into v_bundle_id;
  else
    select id into v_bundle_id
    from public.pdr_requests
    where id = v_proposal.suggested_bundle_id and status = 'accepted';
  end if;

  if v_bundle_id is null then
    raise exception 'Choose an accepted product bundle or the Orphans stream.';
  end if;

  v_title := left(coalesce(nullif(trim(v_proposal.problem_statement), ''), trim(v_proposal.original_text)), 180);
  v_notes := concat_ws(E'\n\n',
    nullif('Desired outcome: ' || v_proposal.desired_outcome, 'Desired outcome: '),
    nullif('Current behavior: ' || v_proposal.current_behavior, 'Current behavior: '),
    nullif('Impact: ' || v_proposal.impact, 'Impact: '),
    nullif('Success signal: ' || v_proposal.success_signal, 'Success signal: '),
    nullif('Constraints: ' || v_proposal.constraints, 'Constraints: '),
    nullif('Platform connection: ' || v_proposal.platform_connection, 'Platform connection: '),
    nullif('Technical impact: ' || v_proposal.technical_impact, 'Technical impact: '),
    nullif('Materials inspected: ' || v_proposal.material_summary, 'Materials inspected: '),
    'Source proposal: ' || v_proposal.id::text
  );
  v_attachments := coalesce(v_proposal.attachments, '[]'::jsonb);
  v_status := coalesce(nullif(p_status_override, ''), 'todo');

  if v_proposal.card_intent = 'replace_existing' then
    if v_proposal.matched_work_card_id is null then
      raise exception 'Choose the Work Card this proposal replaces.';
    end if;

    select * into v_old_card
    from public.pdr_work_cards
    where id = v_proposal.matched_work_card_id
    for update;

    if not found or v_old_card.archived_at is not null then
      raise exception 'The matched Work Card is no longer active.';
    end if;

    if p_status_override is null then
      v_status := v_old_card.status;
    end if;

    select coalesce(jsonb_agg(value), '[]'::jsonb) into v_attachments
    from (
      select distinct on (item->>'url') item as value
      from jsonb_array_elements(coalesce(v_old_card.attachments, '[]'::jsonb) || coalesce(v_proposal.attachments, '[]'::jsonb)) item
      where coalesce(item->>'url', '') <> ''
      order by item->>'url'
    ) deduplicated;
  end if;

  if v_status not in ('todo', 'in_progress', 'review', 'done') then
    raise exception 'Invalid Work Card status.';
  end if;

  insert into public.pdr_work_cards (
    strategic_item_id, title, status, owner, assignees, notes, blocked,
    blocked_reason, attachments, sort_order, source_proposal_id,
    clarification_state, replaces_card_id
  ) values (
    v_bundle_id, v_title, v_status, 'Dev team', '["Dev team"]'::jsonb,
    v_notes, false, '', v_attachments, 0, v_proposal.id, 'none',
    case when v_proposal.card_intent = 'replace_existing' then v_old_card.id else null end
  ) returning id into v_card_id;

  if v_proposal.card_intent = 'replace_existing' then
    update public.pdr_work_cards set
      archived_at = now(),
      archived_reason = 'Replaced by approved proposal ' || v_proposal.id::text,
      replaced_by_card_id = v_card_id,
      updated_at = now()
    where id = v_old_card.id;
  end if;

  update public.pdr_proposals set
    status = 'converted',
    conversion_ref = v_card_id,
    updated_at = now()
  where id = v_proposal.id;

  return jsonb_build_object(
    'work_card_id', v_card_id,
    'bundle_id', v_bundle_id,
    'replaced_card_id', case when v_proposal.card_intent = 'replace_existing' then v_old_card.id else null end,
    'already_converted', false
  );
end;
$$;


--
-- Name: pdr_set_work_card_completed_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."pdr_set_work_card_completed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' then
      new.completed_at := now();
    elsif old.status is distinct from 'done' then
      new.completed_at := now();
    elsif new.completed_at is null then
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;


--
-- Name: prepare_external_pursuit_deletion_fulfillment("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prepare_external_pursuit_deletion_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  actor_role public.app_user_role;
  dossier public.external_pursuits%ROWTYPE;
BEGIN
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));
  PERFORM public.assert_external_pursuit_not_converted(p_dossier_id);
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, TRUE);
  IF dossier.deletion_status <> 'delete_requested' THEN
    RAISE EXCEPTION 'External Pursuit deletion was not requested.';
  END IF;
END;
$$;


--
-- Name: prevent_ma_contact_email_policy_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_contact_email_policy_event_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_contact_email_policy_events_are_immutable';
END
$$;


--
-- Name: prevent_ma_cutover_run_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_cutover_run_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_cutover_runs_are_never_deletable';
END;
$$;


--
-- Name: prevent_ma_interaction_delivery_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_interaction_delivery_event_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_interaction_delivery_events_are_append_only';
END;
$$;


--
-- Name: prevent_ma_interaction_owner_verification_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_interaction_owner_verification_event_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_interaction_owner_verification_events_are_append_only';
END;
$$;


--
-- Name: prevent_ma_opportunity_date_correction_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_opportunity_date_correction_event_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_opportunity_date_correction_events_are_immutable';
END
$$;


--
-- Name: prevent_ma_provisional_source_review_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_provisional_source_review_event_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_provisional_source_review_events_are_immutable';
END;
$$;


--
-- Name: prevent_ma_source_contact_move_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_ma_source_contact_move_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'ma_source_contact_move_history_is_immutable';
END;
$$;


--
-- Name: prevent_opportunity_closure_history_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_opportunity_closure_history_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'opportunity_closure_history_is_immutable';
END;
$$;


--
-- Name: prevent_opportunity_reference_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_opportunity_reference_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'opportunity_reference_is_immutable';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: prevent_retained_opportunity_document_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_retained_opportunity_document_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.document_type::TEXT IN ('source_teaser', 'deal_book') THEN
    RAISE EXCEPTION
      'Retained % documents cannot be deleted; upload a corrected version instead.',
      OLD.document_type;
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: prevent_w039_geography_adoption_evidence_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_w039_geography_adoption_evidence_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ BEGIN RAISE EXCEPTION 'w039_geography_adoption_evidence_is_immutable'; END $$;


--
-- Name: promote_waitlist_repreneur("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."promote_waitlist_repreneur"("p_waitlist_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_actor_user_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  request_row public.waitlist%ROWTYPE;
  target_repreneur_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_waitlist_id::text, 0));

  SELECT * INTO request_row
  FROM public.waitlist
  WHERE id = p_waitlist_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request was not found.';
  END IF;

  IF request_row.promoted_repreneur_id IS NOT NULL THEN
    RETURN request_row.promoted_repreneur_id;
  END IF;

  IF request_row.role <> 'repreneur' THEN
    RAISE EXCEPTION 'Seller access requests cannot be promoted to repreneurs.';
  END IF;

  IF NULLIF(BTRIM(request_row.email), '') IS NULL THEN
    RAISE EXCEPTION 'The access request has no usable email address.';
  END IF;

  -- Serialize normalized-email decisions across duplicate legacy requests. The
  -- existing canonical profile always wins; its names and source stay intact.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('repreneur-email:' || LOWER(BTRIM(request_row.email)), 0)
  );

  SELECT id INTO target_repreneur_id
  FROM public.repreneurs
  WHERE LOWER(BTRIM(email)) = LOWER(BTRIM(request_row.email))
  ORDER BY created_at ASC NULLS LAST, id ASC
  LIMIT 1
  FOR UPDATE;

  IF target_repreneur_id IS NULL THEN
    IF NULLIF(BTRIM(p_first_name), '') IS NULL OR NULLIF(BTRIM(p_last_name), '') IS NULL THEN
      RAISE EXCEPTION 'Both first and last name are required.';
    END IF;

    INSERT INTO public.repreneurs (
      email, first_name, last_name, lifecycle_status, source, consent_source, created_by
    ) VALUES (
      LOWER(BTRIM(request_row.email)),
      BTRIM(p_first_name),
      BTRIM(p_last_name),
      'lead',
      'access_request_staff_review',
      'manual',
      p_actor_user_id
    )
    RETURNING id INTO target_repreneur_id;
  END IF;

  UPDATE public.waitlist
  SET status = 'approved',
      promoted_repreneur_id = target_repreneur_id,
      promoted_at = NOW(),
      promoted_by = p_actor_user_id,
      updated_at = NOW()
  WHERE id = p_waitlist_id;

  RETURN target_repreneur_id;
END;
$$;


--
-- Name: refresh_ma_source_email_send("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."refresh_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
BEGIN
  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL
    OR public.ma_opportunity_source_review_required(opportunity_row.id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.ma_source_email_send_reservations reservation
  SET expires_at = NOW() + INTERVAL '2 minutes'
  WHERE reservation.opportunity_id = opportunity_row.id
    AND reservation.reservation_token = p_reservation_token
    AND reservation.source_office_id IS NOT DISTINCT FROM opportunity_row.source_office_id;

  RETURN FOUND;
END;
$$;


--
-- Name: register_external_pursuit_attachment("uuid", "text", "text", "text", bigint, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."register_external_pursuit_attachment"("p_dossier_id" "uuid", "p_storage_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_byte_size" bigint, "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE p public.external_pursuits%ROWTYPE; attachment_id UUID; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  IF p_storage_path !~ ('^' || p_dossier_id::TEXT || '/[0-9a-f]{64}\.[a-z0-9]{2,5}$') THEN RAISE EXCEPTION 'External Pursuit attachment path is invalid.'; END IF;
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events e WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key) THEN
    SELECT (metadata->>'attachment_id')::UUID INTO attachment_id FROM public.external_pursuit_audit_events e
    WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key AND e.event_type='updated' AND e.metadata->>'kind'='attachment_uploaded'
    LIMIT 1;
    IF attachment_id IS NOT NULL THEN RETURN (SELECT jsonb_build_object('attachment_id',a.id,'storage_path',a.storage_path) FROM public.external_pursuit_attachments a WHERE a.id=attachment_id); END IF;
    RAISE EXCEPTION 'External Pursuit attachment idempotency conflict.';
  END IF;
  INSERT INTO public.external_pursuit_attachments (external_pursuit_id,storage_path,original_filename,content_type,byte_size,created_by)
  VALUES (p_dossier_id,p_storage_path,BTRIM(p_original_filename),p_content_type,p_byte_size,actor)
  RETURNING id INTO attachment_id;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'updated',actor,p_idempotency_key,jsonb_build_object('kind','attachment_uploaded','attachment_id',attachment_id));
  RETURN jsonb_build_object('attachment_id',attachment_id,'storage_path',p_storage_path);
END $_$;


--
-- Name: register_opportunity_nda_artifact("uuid", "uuid", "text", "text", "text", "text", bigint, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."register_opportunity_nda_artifact"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_artifact_role" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text", "p_recorded_by" "text") RETURNS TABLE("artifact_id" "uuid", "document_id" "uuid", "version_number" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  normalized_role public.opportunity_nda_artifact_role;
  normalized_title TEXT := NULLIF(BTRIM(p_title), '');
  normalized_path TEXT := NULLIF(BTRIM(p_storage_path), '');
  normalized_file_name TEXT := NULLIF(BTRIM(p_file_name), '');
  normalized_content_sha256 TEXT := LOWER(NULLIF(BTRIM(p_content_sha256), ''));
  normalized_actor TEXT := NULLIF(BTRIM(p_recorded_by), '');
  normalized_mime_type TEXT;
  match_opportunity_id UUID;
  prior_artifact_id UUID;
  next_version INTEGER;
  new_document_id UUID;
  new_artifact_id UUID;
  staff_role_count INTEGER;
BEGIN
  IF p_artifact_role IS NULL OR p_artifact_role NOT IN ('blank_template', 'renew_signed_copy', 'repreneur_signed_copy') THEN
    RAISE EXCEPTION 'Unsupported NDA artifact role.';
  END IF;
  normalized_role := p_artifact_role::public.opportunity_nda_artifact_role;

  IF normalized_title IS NULL THEN RAISE EXCEPTION 'Artifact title is required.'; END IF;
  IF normalized_actor IS NULL THEN RAISE EXCEPTION 'A staff actor is required.'; END IF;

  SELECT COUNT(*) INTO staff_role_count
  FROM public.app_user_roles
  WHERE LOWER(email) = LOWER(normalized_actor) AND role = 'staff';
  IF staff_role_count <> 1 THEN RAISE EXCEPTION 'Artifact registration requires one active staff identity.'; END IF;

  PERFORM 1 FROM public.opportunities WHERE id = p_opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found.'; END IF;

  IF normalized_role = 'blank_template' THEN
    IF p_match_id IS NOT NULL THEN RAISE EXCEPTION 'A blank NDA template belongs to the opportunity, not a pursuit.'; END IF;
  ELSE
    IF p_match_id IS NULL THEN RAISE EXCEPTION 'A signed NDA copy requires a pursuit.'; END IF;
    SELECT opportunity_id INTO match_opportunity_id FROM public.opportunity_matches WHERE id = p_match_id;
    IF match_opportunity_id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
    IF match_opportunity_id <> p_opportunity_id THEN RAISE EXCEPTION 'Pursuit does not belong to the selected opportunity.'; END IF;
  END IF;

  IF normalized_path IS NULL THEN RAISE EXCEPTION 'Upload one retained NDA file.'; END IF;
  IF normalized_path NOT LIKE p_opportunity_id::TEXT || '/nda-artifacts/' || normalized_role::TEXT || '/%' THEN
    RAISE EXCEPTION 'Stored NDA artifact path is outside its canonical role folder.';
  END IF;
  IF normalized_file_name IS NULL THEN RAISE EXCEPTION 'Stored NDA artifacts require a file name.'; END IF;
  IF normalized_role = 'blank_template' AND LOWER(normalized_file_name) LIKE '%.docx' THEN
    normalized_mime_type := 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  ELSIF LOWER(normalized_file_name) LIKE '%.pdf' THEN
    normalized_mime_type := 'application/pdf';
  ELSIF normalized_role = 'blank_template' THEN
    RAISE EXCEPTION 'Stored blank NDA templates must be PDF or DOCX files.';
  ELSE
    RAISE EXCEPTION 'Signed NDA artifacts must be PDFs.';
  END IF;
  IF normalized_role <> 'blank_template' AND normalized_mime_type <> 'application/pdf' THEN
    RAISE EXCEPTION 'Signed NDA artifacts must be PDFs.';
  END IF;
  IF p_file_size IS NULL OR p_file_size <= 0 THEN RAISE EXCEPTION 'Stored NDA artifact file size must be positive.'; END IF;
  IF normalized_content_sha256 IS NULL OR normalized_content_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Stored NDA artifacts require a SHA-256 content digest.';
  END IF;

  SELECT artifact.id, artifact.version_number + 1 INTO prior_artifact_id, next_version
  FROM public.opportunity_nda_artifacts AS artifact
  WHERE artifact.opportunity_id = p_opportunity_id
    AND artifact.match_id IS NOT DISTINCT FROM p_match_id
    AND artifact.artifact_role = normalized_role
  ORDER BY artifact.version_number DESC LIMIT 1;
  IF next_version IS NULL THEN next_version := 1; END IF;

  INSERT INTO public.opportunity_documents (opportunity_id, title, document_type, visibility, storage_bucket, storage_path, external_url, file_name, size_bytes, mime_type, uploaded_by)
  VALUES (p_opportunity_id, normalized_title, 'nda', 'staff_only', 'opportunity-documents', normalized_path, NULL, normalized_file_name, p_file_size, normalized_mime_type, normalized_actor)
  RETURNING id INTO new_document_id;

  INSERT INTO public.opportunity_nda_artifacts (opportunity_id, match_id, document_id, artifact_role, version_number, content_sha256, supersedes_artifact_id, recorded_by)
  VALUES (p_opportunity_id, p_match_id, new_document_id, normalized_role, next_version, normalized_content_sha256, prior_artifact_id, normalized_actor)
  RETURNING id INTO new_artifact_id;

  RETURN QUERY SELECT new_artifact_id, new_document_id, next_version;
END;
$_$;


--
-- Name: reject_external_pursuit_audit_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_external_pursuit_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('wave.external_pursuit_delete_purge', TRUE) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'External Pursuit audit is immutable.';
END $$;


--
-- Name: reject_external_pursuit_conversion_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_external_pursuit_conversion_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'External Pursuit conversion evidence is immutable.';
END $$;


--
-- Name: reject_linked_nda_document_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_linked_nda_document_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.opportunity_nda_artifacts AS artifact
    WHERE artifact.document_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'This document is retained canonical NDA evidence; register a new version instead.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


--
-- Name: reject_opportunity_nda_artifact_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_opportunity_nda_artifact_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION
    'Canonical NDA artifact evidence is immutable; register a new version instead.';
END;
$$;


--
-- Name: reject_opportunity_pursuit_evidence_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_opportunity_pursuit_evidence_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN RAISE EXCEPTION 'Canonical pursuit evidence is append-only.'; END; $$;


--
-- Name: release_ma_source_email_send("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."release_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM public.ma_source_email_send_reservations reservation
  WHERE reservation.opportunity_id = p_opportunity_id
    AND reservation.reservation_token = p_reservation_token;

  RETURN FOUND;
END;
$$;


--
-- Name: replace_repreneur_geography_targets("uuid", "text"[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."replace_repreneur_geography_targets"("p_repreneur_id" "uuid", "p_stable_keys" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE requested_count INTEGER; resolved_count INTEGER;
BEGIN
  IF p_repreneur_id IS NULL THEN RAISE EXCEPTION 'repreneur_geography_target_repreneur_required'; END IF;
  SELECT COUNT(DISTINCT BTRIM(key)) INTO requested_count FROM UNNEST(COALESCE(p_stable_keys, ARRAY[]::TEXT[])) AS item(key) WHERE NULLIF(BTRIM(key), '') IS NOT NULL;
  SELECT COUNT(*) INTO resolved_count FROM public.geography_nodes WHERE stable_key = ANY(COALESCE(p_stable_keys, ARRAY[]::TEXT[]));
  IF requested_count <> resolved_count THEN RAISE EXCEPTION 'repreneur_geography_target_not_found'; END IF;
  DELETE FROM public.repreneur_geography_targets WHERE repreneur_id = p_repreneur_id;
  INSERT INTO public.repreneur_geography_targets(repreneur_id, geography_node_id)
    SELECT p_repreneur_id, id FROM public.geography_nodes WHERE stable_key = ANY(COALESCE(p_stable_keys, ARRAY[]::TEXT[]));
END $$;


--
-- Name: request_external_pursuit_deletion("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."request_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role;
BEGIN
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'repreneur' THEN RAISE EXCEPTION 'Only the owner repreneur may request deletion.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  PERFORM public.assert_external_pursuit_not_converted(p_dossier_id);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.event_type='delete_requested' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key) THEN RETURN; END IF;
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE);
  IF p.deletion_status <> 'active' OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'External Pursuit deletion request is invalid.'; END IF;
  UPDATE public.external_pursuits SET deletion_status='delete_requested',updated_by=actor,updated_at=clock_timestamp() WHERE id=p_dossier_id;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'delete_requested',actor,p_idempotency_key);
END $$;


--
-- Name: reserve_ma_source_email_send("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reserve_ma_source_email_send"("p_opportunity_id" "uuid", "p_actor" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  reservation_id UUID;
  actor TEXT;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_source_email_reservation_actor_required';
  END IF;

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;

  PERFORM public.assert_ma_provisional_source_context_integrity();
  IF public.ma_opportunity_source_review_required(opportunity_row.id) THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_external_email';
  END IF;

  DELETE FROM public.ma_source_email_send_reservations reservation
  WHERE reservation.opportunity_id = opportunity_row.id
    AND reservation.expires_at <= NOW();

  INSERT INTO public.ma_source_email_send_reservations (
    opportunity_id,
    source_office_id,
    actor,
    expires_at
  ) VALUES (
    opportunity_row.id,
    opportunity_row.source_office_id,
    actor,
    NOW() + INTERVAL '2 minutes'
  )
  ON CONFLICT (opportunity_id) DO NOTHING
  RETURNING reservation_token INTO reservation_id;

  IF reservation_id IS NULL THEN
    RAISE EXCEPTION 'ma_source_email_send_already_in_progress';
  END IF;

  RETURN reservation_id;
END;
$$;


--
-- Name: resolve_acme_provisional_source("uuid", "uuid", "uuid"[], "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."resolve_acme_provisional_source"("p_opportunity_id" "uuid", "p_replacement_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_actor" "text", "p_reason" "text") RETURNS "public"."opportunities"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  assignment_row public.ma_provisional_source_review_events%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  actor TEXT;
  reason TEXT;
  prior_source_snapshot JSONB;
  prior_contact_snapshot JSONB;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  reason := NULLIF(BTRIM(p_reason), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_actor_required';
  END IF;
  IF reason IS NULL OR CHAR_LENGTH(reason) > 4096 THEN
    RAISE EXCEPTION 'ma_provisional_source_reason_required';
  END IF;
  IF p_replacement_office_id IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_real_office';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ma-provisional-source-cutover-readiness', 76064)
  );
  PERFORM public.assert_ma_provisional_source_context_integrity();

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;

  DELETE FROM public.ma_source_email_send_reservations reservation
  WHERE reservation.opportunity_id = opportunity_row.id
    AND reservation.expires_at <= NOW();
  IF EXISTS (
    SELECT 1
    FROM public.ma_source_email_send_reservations reservation
    WHERE reservation.opportunity_id = opportunity_row.id
      AND reservation.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'ma_provisional_source_change_blocked_during_email_send';
  END IF;

  IF opportunity_row.status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_supports_draft_active_or_paused_only';
  END IF;

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF context_row.context_key IS NULL
    OR opportunity_row.source_office_id IS DISTINCT FROM context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_current_acme_source';
  END IF;
  IF p_replacement_office_id = context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_real_office';
  END IF;

  SELECT *
  INTO assignment_row
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.opportunity_id = opportunity_row.id
    AND assignment.provisional_office_id = context_row.office_id
    AND assignment.event_kind = 'assigned'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ma_provisional_source_review_events resolution
      WHERE resolution.event_kind = 'resolved'
        AND resolution.related_assignment_id = assignment.id
    )
  ORDER BY assignment.occurred_at DESC, assignment.id DESC
  LIMIT 1
  FOR UPDATE;

  IF assignment_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_assignment_evidence';
  END IF;

  prior_source_snapshot := public.ma_opportunity_source_snapshot(opportunity_row.id);
  prior_contact_snapshot := public.ma_opportunity_contact_snapshot(opportunity_row.id);

  saved_opportunity := public.save_opportunity_office_context(
    opportunity_row.id,
    p_replacement_office_id,
    p_affiliation_ids,
    p_primary_affiliation_id,
    NULL,
    opportunity_row.status,
    actor,
    '{}'::JSONB
  );

  INSERT INTO public.ma_provisional_source_review_events (
    opportunity_id,
    provisional_office_id,
    event_kind,
    related_assignment_id,
    prior_source_office_id,
    resulting_source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    resulting_source_snapshot,
    resulting_contact_snapshot,
    actor,
    reason
  ) VALUES (
    opportunity_row.id,
    context_row.office_id,
    'resolved',
    assignment_row.id,
    opportunity_row.source_office_id,
    saved_opportunity.source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    public.ma_opportunity_source_snapshot(saved_opportunity.id),
    public.ma_opportunity_contact_snapshot(saved_opportunity.id),
    actor,
    reason
  );

  RETURN saved_opportunity;
END;
$$;


--
-- Name: geography_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."geography_nodes" (
    "id" "uuid" NOT NULL,
    "stable_key" "text" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "node_level" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "geography_nodes_check" CHECK (((("node_level" = 'country'::"text") AND ("parent_id" IS NULL)) OR (("node_level" <> 'country'::"text") AND ("parent_id" IS NOT NULL)))),
    CONSTRAINT "geography_nodes_check1" CHECK (("parent_id" IS DISTINCT FROM "id")),
    CONSTRAINT "geography_nodes_code_check" CHECK ((NULLIF("btrim"("code"), ''::"text") IS NOT NULL)),
    CONSTRAINT "geography_nodes_label_check" CHECK ((NULLIF("btrim"("label"), ''::"text") IS NOT NULL)),
    CONSTRAINT "geography_nodes_node_level_check" CHECK (("node_level" = ANY (ARRAY['country'::"text", 'macro_zone'::"text", 'region'::"text"]))),
    CONSTRAINT "geography_nodes_stable_key_check" CHECK (("stable_key" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);

ALTER TABLE ONLY "public"."geography_nodes" FORCE ROW LEVEL SECURITY;


--
-- Name: resolve_w039_geography_node("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."resolve_w039_geography_node"("p_value" "text") RETURNS "public"."geography_nodes"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $_$
DECLARE node public.geography_nodes%ROWTYPE;
BEGIN
  IF NULLIF(BTRIM(p_value), '') IS NULL THEN RAISE EXCEPTION 'opportunity_geography_required'; END IF;
  IF BTRIM(p_value) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'opportunity_geography_not_found';
  END IF;
  SELECT * INTO node FROM public.geography_nodes WHERE id = BTRIM(p_value)::UUID;
  IF node.id IS NULL THEN RAISE EXCEPTION 'opportunity_geography_not_found'; END IF;
  RETURN node;
END $_$;


--
-- Name: save_external_pursuit_contact("uuid", "uuid", "text", "text", "text", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."save_external_pursuit_contact"("p_dossier_id" "uuid", "p_contact_id" "uuid", "p_name" "text", "p_organisation" "text", "p_role_title" "text", "p_email" "text", "p_phone" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; v_contact_id UUID := p_contact_id; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); event_type public.external_pursuit_audit_event_type; replay JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE);
  SELECT metadata INTO replay FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key AND a.event_type IN ('contact_created','contact_updated') ORDER BY a.occurred_at DESC LIMIT 1;
  IF replay IS NOT NULL THEN RETURN (replay->>'contact_id')::UUID; END IF;
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF (NULLIF(BTRIM(p_name),'') IS NULL AND NULLIF(BTRIM(p_organisation),'') IS NULL) OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'A contact needs a name or organisation and an idempotency key.'; END IF;
  IF v_contact_id IS NULL THEN INSERT INTO public.external_pursuit_contacts (external_pursuit_id,name,organisation,role_title,email,phone,created_by,updated_by) VALUES (p_dossier_id,NULLIF(BTRIM(p_name),''),NULLIF(BTRIM(p_organisation),''),NULLIF(BTRIM(p_role_title),''),NULLIF(BTRIM(p_email),''),NULLIF(BTRIM(p_phone),''),actor,actor) RETURNING id INTO v_contact_id; event_type := 'contact_created';
  ELSE IF NOT EXISTS (SELECT 1 FROM public.external_pursuit_contacts c WHERE c.id=v_contact_id AND c.external_pursuit_id=p_dossier_id) THEN RAISE EXCEPTION 'External Pursuit contact not found.'; END IF; UPDATE public.external_pursuit_contacts c SET name=NULLIF(BTRIM(p_name),''),organisation=NULLIF(BTRIM(p_organisation),''),role_title=NULLIF(BTRIM(p_role_title),''),email=NULLIF(BTRIM(p_email),''),phone=NULLIF(BTRIM(p_phone),''),updated_by=actor,updated_at=clock_timestamp() WHERE c.id=v_contact_id; event_type := 'contact_updated'; END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,event_type,actor,p_idempotency_key,jsonb_build_object('contact_id',v_contact_id)); RETURN v_contact_id;
END $$;


--
-- Name: save_opportunity_office_context("uuid", "uuid", "uuid"[], "uuid", "text", "public"."opportunity_status", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."save_opportunity_office_context"("p_opportunity_id" "uuid", "p_source_office_id" "uuid" DEFAULT NULL::"uuid", "p_affiliation_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_primary_affiliation_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_target_status" "public"."opportunity_status" DEFAULT 'draft'::"public"."opportunity_status", "p_actor" "text" DEFAULT NULL::"text", "p_opportunity_fields" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."opportunities"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE node public.geography_nodes%ROWTYPE; saved public.opportunities%ROWTYPE; legacy_fields JSONB; confirm_day BOOLEAN;
BEGIN
  confirm_day := public.validate_w098_date_precision_write(p_opportunity_id, p_opportunity_fields);
  legacy_fields := p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day'];
  saved := public.save_opportunity_office_context_legacy(p_opportunity_id,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,legacy_fields);
  IF p_opportunity_fields ? 'geography_node_id' THEN
    node := public.resolve_w039_geography_node(p_opportunity_fields ->> 'geography_node_id');
    UPDATE public.opportunities SET geography_node_id = node.id, updated_by = NULLIF(BTRIM(p_actor), ''), updated_at = NOW()
      WHERE id = saved.id RETURNING * INTO saved;
  END IF;
  IF confirm_day THEN
    UPDATE public.opportunities
    SET date_added_precision = 'day',
        updated_by = NULLIF(BTRIM(p_actor), ''),
        updated_at = NOW()
    WHERE id = saved.id
    RETURNING * INTO saved;
  END IF;
  RETURN saved;
END $$;


--
-- Name: save_opportunity_office_context_legacy("uuid", "uuid", "uuid"[], "uuid", "text", "public"."opportunity_status", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."save_opportunity_office_context_legacy"("p_opportunity_id" "uuid", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_primary_affiliation_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_target_status" "public"."opportunity_status" DEFAULT NULL::"public"."opportunity_status", "p_actor" "text" DEFAULT NULL::"text", "p_opportunity_fields" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."opportunities"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  office_row public.ma_offices%ROWTYPE;
  firm_row public.ma_firms%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  requested_affiliation_ids UUID[];
  requested_affiliation_count INTEGER;
  active_affiliation_count INTEGER;
  target_status public.opportunity_status;
  actor TEXT;
  opportunity_fields JSONB;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'opportunity_office_context_actor_required';
  END IF;

  opportunity_fields := COALESCE(p_opportunity_fields, '{}'::JSONB);
  IF jsonb_typeof(opportunity_fields) <> 'object' THEN
    RAISE EXCEPTION 'opportunity_intake_fields_must_be_object';
  END IF;

  IF opportunity_fields ?| ARRAY[
    'source_id',
    'source_label',
    'source_office_id',
    'repreneur_exposure',
    'origin_channel',
    'imported_from',
    'imported_at'
  ] THEN
    RAISE EXCEPTION 'opportunity_intake_fields_contains_forbidden_key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(opportunity_fields) AS supplied(key)
    WHERE supplied.key NOT IN (
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
    RAISE EXCEPTION 'opportunity_intake_fields_contains_unsupported_key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(opportunity_fields) AS supplied(key, value)
    WHERE (
      supplied.key IN (
        'sector',
        'activity',
        'location',
        'headcount_range',
        'date_added',
        'public_title',
        'teaser_summary',
        'internal_notes'
      )
      AND jsonb_typeof(supplied.value) NOT IN ('string', 'null')
    )
    OR (
      supplied.key IN ('revenue_meur', 'ebitda_keur', 'headcount')
      AND jsonb_typeof(supplied.value) NOT IN ('number', 'string', 'null')
    )
  ) THEN
    RAISE EXCEPTION 'opportunity_intake_fields_has_invalid_value_type';
  END IF;

  requested_affiliation_ids := COALESCE(
    ARRAY(
      SELECT DISTINCT affiliation_id
      FROM UNNEST(COALESCE(p_affiliation_ids, ARRAY[]::UUID[])) AS requested(affiliation_id)
      ORDER BY affiliation_id
    ),
    ARRAY[]::UUID[]
  );
  requested_affiliation_count := CARDINALITY(requested_affiliation_ids);

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;

  target_status := COALESCE(p_target_status, opportunity_row.status);
  IF opportunity_row.status IN ('closed', 'archived')
    AND target_status IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'opportunity_office_context_cannot_change_historical_status';
  END IF;

  IF target_status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'opportunity_office_context_supports_draft_active_or_paused_only';
  END IF;

  -- Drafts intentionally remain staff-only and may have no office or contact.
  -- A caller cannot use this branch for active or paused status.
  IF p_source_office_id IS NULL THEN
    IF target_status <> 'draft' THEN
      RAISE EXCEPTION 'opportunity_activation_requires_source_office';
    END IF;

    IF requested_affiliation_count <> 0 OR p_primary_affiliation_id IS NOT NULL THEN
      RAISE EXCEPTION 'opportunity_contact_requires_source_office';
    END IF;

    PERFORM 1
    FROM public.opportunity_ma_contacts link
    WHERE link.opportunity_id = opportunity_row.id
    ORDER BY link.id
    FOR UPDATE;

    UPDATE public.opportunity_ma_contacts
    SET
      is_active = FALSE,
      is_primary = FALSE,
      removed_by = actor,
      removed_at = NOW()
    WHERE opportunity_id = opportunity_row.id
      AND is_active;

    UPDATE public.opportunities
    SET
      source_office_id = NULL,
      repreneur_exposure = 'staff_only'::public.opportunity_visibility,
      description = CASE
        WHEN p_description IS NULL THEN description
        ELSE NULLIF(BTRIM(p_description), '')
      END,
      sector = CASE
        WHEN opportunity_fields ? 'sector' THEN NULLIF(BTRIM(opportunity_fields ->> 'sector'), '')
        ELSE sector
      END,
      activity = CASE
        WHEN opportunity_fields ? 'activity' THEN NULLIF(BTRIM(opportunity_fields ->> 'activity'), '')
        ELSE activity
      END,
      location = CASE
        WHEN opportunity_fields ? 'location' THEN NULLIF(BTRIM(opportunity_fields ->> 'location'), '')
        ELSE location
      END,
      revenue_meur = CASE
        WHEN opportunity_fields ? 'revenue_meur'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'revenue_meur'), '')::NUMERIC(12, 2)
        ELSE revenue_meur
      END,
      ebitda_keur = CASE
        WHEN opportunity_fields ? 'ebitda_keur'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'ebitda_keur'), '')::NUMERIC(12, 2)
        ELSE ebitda_keur
      END,
      headcount = CASE
        WHEN opportunity_fields ? 'headcount'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount'), '')::INTEGER
        ELSE headcount
      END,
      headcount_range = CASE
        WHEN opportunity_fields ? 'headcount_range'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount_range'), '')
        ELSE headcount_range
      END,
      date_added = CASE
        WHEN opportunity_fields ? 'date_added'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'date_added'), '')::DATE
        ELSE date_added
      END,
      public_title = CASE
        WHEN opportunity_fields ? 'public_title'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'public_title'), '')
        ELSE public_title
      END,
      teaser_summary = CASE
        WHEN opportunity_fields ? 'teaser_summary'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'teaser_summary'), '')
        ELSE teaser_summary
      END,
      internal_notes = CASE
        WHEN opportunity_fields ? 'internal_notes'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'internal_notes'), '')
        ELSE internal_notes
      END,
      status = 'draft',
      updated_by = actor
    WHERE id = opportunity_row.id
    RETURNING * INTO saved_opportunity;

    PERFORM public.assert_opportunity_office_context(saved_opportunity.id);
    RETURN saved_opportunity;
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = p_source_office_id
  FOR KEY SHARE;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_office_not_found';
  END IF;

  -- A synthetic default is a temporary compatibility anchor. It cannot be
  -- selected for a new or changed opportunity once a real active office is
  -- known for the same firm. Historical links are intentionally untouched.
  IF office_row.is_default
    AND EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office_row.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    ) THEN
    RAISE EXCEPTION 'opportunity_source_office_requires_real_office_selection';
  END IF;

  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = office_row.firm_id
  FOR UPDATE;

  IF firm_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_firm_not_found';
  END IF;

  -- Lock selected affiliations in UUID order, then verify they are active and
  -- attached to the requested office. Generic mailbox/affiliation shortcuts
  -- cannot become an opportunity primary contact through this RPC.
  PERFORM 1
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.id = ANY(requested_affiliation_ids)
  ORDER BY affiliation.id
  FOR KEY SHARE;

  SELECT COUNT(*)
  INTO active_affiliation_count
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.id = ANY(requested_affiliation_ids)
    AND affiliation.office_id = office_row.id
    AND affiliation.is_active
    AND contact.status = 'active';

  IF active_affiliation_count <> requested_affiliation_count THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_not_active_for_source_office';
  END IF;

  IF p_primary_affiliation_id IS NOT NULL
    AND NOT (p_primary_affiliation_id = ANY(requested_affiliation_ids)) THEN
    RAISE EXCEPTION 'opportunity_primary_affiliation_must_be_selected';
  END IF;

  -- Lock current links after the selected source context. Clearing primary
  -- flags before link replacement avoids a transient partial-index conflict.
  PERFORM 1
  FROM public.opportunity_ma_contacts link
  WHERE link.opportunity_id = opportunity_row.id
  ORDER BY link.id
  FOR UPDATE;

  UPDATE public.opportunity_ma_contacts
  SET is_primary = FALSE
  WHERE opportunity_id = opportunity_row.id
    AND is_active
    AND is_primary;

  UPDATE public.opportunity_ma_contacts
  SET
    is_active = FALSE,
    is_primary = FALSE,
    removed_by = actor,
    removed_at = NOW()
  WHERE opportunity_id = opportunity_row.id
    AND is_active
    AND NOT (affiliation_id = ANY(requested_affiliation_ids));

  INSERT INTO public.opportunity_ma_contacts (
    opportunity_id,
    affiliation_id,
    is_primary,
    is_active,
    linked_by,
    linked_at,
    removed_by,
    removed_at
  )
  SELECT
    opportunity_row.id,
    affiliation_id,
    FALSE,
    TRUE,
    actor,
    NOW(),
    NULL,
    NULL
  FROM UNNEST(requested_affiliation_ids) AS requested(affiliation_id)
  ON CONFLICT (opportunity_id, affiliation_id) DO UPDATE
  SET
    is_active = TRUE,
    is_primary = FALSE,
    linked_by = EXCLUDED.linked_by,
    linked_at = EXCLUDED.linked_at,
    removed_by = NULL,
    removed_at = NULL;

  IF p_primary_affiliation_id IS NOT NULL THEN
    UPDATE public.opportunity_ma_contacts
    SET is_primary = TRUE
    WHERE opportunity_id = opportunity_row.id
      AND affiliation_id = p_primary_affiliation_id
      AND is_active;
  END IF;

  UPDATE public.opportunities
  SET
    source_office_id = office_row.id,
    repreneur_exposure = CASE
      WHEN opportunity_row.status = 'draft' OR target_status = 'draft'
        THEN 'staff_only'::public.opportunity_visibility
      ELSE repreneur_exposure
    END,
    description = CASE
      WHEN p_description IS NULL THEN description
      ELSE NULLIF(BTRIM(p_description), '')
    END,
    sector = CASE
      WHEN opportunity_fields ? 'sector' THEN NULLIF(BTRIM(opportunity_fields ->> 'sector'), '')
      ELSE sector
    END,
    activity = CASE
      WHEN opportunity_fields ? 'activity' THEN NULLIF(BTRIM(opportunity_fields ->> 'activity'), '')
      ELSE activity
    END,
    location = CASE
      WHEN opportunity_fields ? 'location' THEN NULLIF(BTRIM(opportunity_fields ->> 'location'), '')
      ELSE location
    END,
    revenue_meur = CASE
      WHEN opportunity_fields ? 'revenue_meur'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'revenue_meur'), '')::NUMERIC(12, 2)
      ELSE revenue_meur
    END,
    ebitda_keur = CASE
      WHEN opportunity_fields ? 'ebitda_keur'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'ebitda_keur'), '')::NUMERIC(12, 2)
      ELSE ebitda_keur
    END,
    headcount = CASE
      WHEN opportunity_fields ? 'headcount'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount'), '')::INTEGER
      ELSE headcount
    END,
    headcount_range = CASE
      WHEN opportunity_fields ? 'headcount_range'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount_range'), '')
      ELSE headcount_range
    END,
    date_added = CASE
      WHEN opportunity_fields ? 'date_added'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'date_added'), '')::DATE
      ELSE date_added
    END,
    public_title = CASE
      WHEN opportunity_fields ? 'public_title'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'public_title'), '')
      ELSE public_title
    END,
    teaser_summary = CASE
      WHEN opportunity_fields ? 'teaser_summary'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'teaser_summary'), '')
      ELSE teaser_summary
    END,
    internal_notes = CASE
      WHEN opportunity_fields ? 'internal_notes'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'internal_notes'), '')
      ELSE internal_notes
    END,
    status = target_status,
    updated_by = actor
  WHERE id = opportunity_row.id
  RETURNING * INTO saved_opportunity;

  PERFORM public.assert_opportunity_office_context(saved_opportunity.id);
  RETURN saved_opportunity;
END;
$$;


--
-- Name: set_ma_contact_campaign_email_suppression("uuid", boolean, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_ma_contact_campaign_email_suppression"("p_contact_id" "uuid", "p_suppressed" boolean, "p_reason" "text", "p_actor" "text") RETURNS TABLE("contact_id" "uuid", "campaign_email_suppressed" boolean, "campaign_email_suppression_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
  clean_reason TEXT := NULLIF(BTRIM(p_reason), '');
  clean_actor TEXT := NULLIF(BTRIM(p_actor), '');
BEGIN
  IF p_suppressed IS NULL
    OR clean_reason IS NULL
    OR CHAR_LENGTH(clean_reason) < 5
    OR CHAR_LENGTH(clean_reason) > 500
    OR clean_actor IS NULL THEN
    RAISE EXCEPTION
      'ma_contact_campaign_email_suppression_requires_state_actor_and_reason';
  END IF;

  SELECT *
  INTO contact_row
  FROM public.ma_contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_contact_campaign_email_suppression_contact_not_found';
  END IF;

  IF contact_row.campaign_email_suppressed = p_suppressed THEN
    RAISE EXCEPTION 'ma_contact_campaign_email_suppression_state_unchanged';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ma_source_email_send_reservations reservation
    JOIN public.opportunity_ma_contacts link
      ON link.opportunity_id = reservation.opportunity_id
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    WHERE affiliation.contact_id = p_contact_id
      AND link.is_active
      AND link.removed_at IS NULL
      AND reservation.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION
      'ma_contact_campaign_email_suppression_change_blocked_during_send';
  END IF;

  PERFORM set_config(
    'app.ma_contact_campaign_email_suppression_change',
    'true',
    TRUE
  );

  UPDATE public.ma_contacts contact
  SET
    campaign_email_suppressed = p_suppressed,
    campaign_email_suppression_reason = CASE
      WHEN p_suppressed THEN clean_reason
      ELSE NULL
    END,
    updated_by = clean_actor,
    updated_at = NOW()
  WHERE contact.id = p_contact_id;

  INSERT INTO public.ma_contact_email_policy_events (
    contact_id,
    event_type,
    previous_suppressed,
    resulting_suppressed,
    actor,
    reason
  )
  VALUES (
    p_contact_id,
    CASE
      WHEN p_suppressed THEN 'suppression_enabled'
      ELSE 'suppression_removed'
    END,
    contact_row.campaign_email_suppressed,
    p_suppressed,
    clean_actor,
    clean_reason
  );

  RETURN QUERY
  SELECT
    contact.id,
    contact.campaign_email_suppressed,
    contact.campaign_email_suppression_reason
  FROM public.ma_contacts contact
  WHERE contact.id = p_contact_id;
END
$$;


--
-- Name: set_task_actual_start(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_task_actual_start"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' AND NEW.actual_start_date IS NULL THEN
    NEW.actual_start_date = CURRENT_DATE;
  END IF;
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.actual_end_date IS NULL THEN
    NEW.actual_end_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: supersede_ma_cutover_run("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."supersede_ma_cutover_run"("p_run_id" "uuid", "p_actor" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  run_row public.ma_cutover_runs%ROWTYPE;
  purged_stage_rows INTEGER := 0;
  purged_stage_issues INTEGER := 0;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_supersession_actor_required';
  END IF;

  SELECT *
  INTO run_row
  FROM public.ma_cutover_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF run_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_cutover_run_not_found';
  END IF;

  IF run_row.status NOT IN ('draft', 'staged', 'review_required', 'approved') THEN
    RAISE EXCEPTION 'ma_cutover_supersession_requires_open_run';
  END IF;

  -- Lock the same rows before their controlled purge. Stage mutations first
  -- lock the run, so this serializes a revision/review operation with close.
  -- Gate 2 exercises concurrent staging and supersession; this SQL keeps the
  -- shared run → stage-row → issue lock order rather than claiming a static
  -- proof of runtime contention behavior.
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

  CREATE TEMP TABLE IF NOT EXISTS ma_cutover_supersession_guard (
    run_id UUID PRIMARY KEY
  ) ON COMMIT DROP;
  INSERT INTO ma_cutover_supersession_guard (run_id)
  VALUES (run_row.id)
  ON CONFLICT (run_id) DO NOTHING;

  DELETE FROM public.ma_cutover_stage_issues
  WHERE run_id = run_row.id;
  GET DIAGNOSTICS purged_stage_issues = ROW_COUNT;

  DELETE FROM public.ma_cutover_stage_rows
  WHERE run_id = run_row.id;
  GET DIAGNOSTICS purged_stage_rows = ROW_COUNT;

  UPDATE public.ma_cutover_runs
  SET
    status = 'superseded',
    superseded_by = BTRIM(p_actor),
    superseded_at = NOW()
  WHERE id = run_row.id;

  RETURN JSONB_BUILD_OBJECT(
    'status', 'superseded',
    'stage_rows_purged', purged_stage_rows,
    'stage_issues_purged', purged_stage_issues
  );
END;
$$;


--
-- Name: sync_opportunity_date_added_precision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."sync_opportunity_date_added_precision"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.date_added IS NULL THEN
      NEW.date_added_precision := NULL;
    ELSIF NEW.date_added_precision IS NULL THEN
      NEW.date_added_precision := 'day';
    END IF;
  ELSIF NEW.date_added IS DISTINCT FROM OLD.date_added
    AND NEW.date_added_precision IS NOT DISTINCT FROM OLD.date_added_precision THEN
    IF NEW.date_added IS NULL THEN
      NEW.date_added_precision := NULL;
    ELSE
      NEW.date_added_precision := 'day';
    END IF;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: sync_repreneur_geography_targets_from_legacy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."sync_repreneur_geography_targets_from_legacy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM public.repreneur_geography_targets WHERE repreneur_id = NEW.id;
  INSERT INTO public.repreneur_geography_targets(repreneur_id, geography_node_id)
  SELECT NEW.id, node.id
  FROM public.geography_nodes node
  JOIN (
    VALUES
      ('all-france', 'france'),
      ('auvergne-rhone-alpes', 'fr-region-auvergne-rhone-alpes'),
      ('bourgogne-franche-comte', 'fr-region-bourgogne-franche-comte'),
      ('bretagne', 'fr-region-brittany'),
      ('centre-val-de-loire', 'fr-region-centre-val-de-loire'),
      ('corse', 'fr-region-corsica'),
      ('dom-tom', 'fr-region-overseas'),
      ('grand-est', 'fr-region-grand-est'),
      ('hauts-de-france', 'fr-region-hauts-de-france'),
      ('ile-de-france', 'fr-region-idf'),
      ('normandie', 'fr-region-normandy'),
      ('nouvelle-aquitaine', 'fr-region-nouvelle-aquitaine'),
      ('occitanie', 'fr-region-occitanie'),
      ('pays-de-la-loire', 'fr-region-pays-de-la-loire'),
      ('paca', 'fr-region-provence-alpes-cote-d-azur')
  ) AS mapped(legacy_value, stable_key)
    ON mapped.legacy_value IN (
      SELECT jsonb_array_elements_text(
        CASE
          WHEN JSONB_TYPEOF(NEW.q12_geo_zones) = 'array'
             AND JSONB_ARRAY_LENGTH(NEW.q12_geo_zones) > 0 THEN NEW.q12_geo_zones
          WHEN JSONB_TYPEOF(NEW.target_location) = 'array' THEN NEW.target_location
          ELSE '[]'::JSONB
        END
      )
    )
  WHERE node.stable_key = mapped.stable_key;
  RETURN NEW;
END $$;


--
-- Name: transition_repreneur_offer_decision("uuid", "uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."transition_repreneur_offer_decision"("p_repreneur_offer_id" "uuid", "p_repreneur_id" "uuid", "p_new_status" "text", "p_decline_reason_category" "text" DEFAULT NULL::"text", "p_decline_reason_text" "text" DEFAULT NULL::"text") RETURNS TABLE("status" "text", "accepted_at" timestamp with time zone, "expires_at" timestamp with time zone, "declined_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_offer public.repreneur_offers%ROWTYPE;
  v_duration_days INTEGER;
  v_decided_at TIMESTAMPTZ := NOW();
  v_transitioned BOOLEAN := FALSE;
BEGIN
  IF p_new_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Only offered decisions can be accepted or declined.';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.repreneur_offers ro
  WHERE ro.id = p_repreneur_offer_id
    AND ro.repreneur_id = p_repreneur_id
  FOR UPDATE OF ro;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This offer no longer belongs to this repreneur. Refresh and try again.';
  END IF;

  SELECT duration_days INTO v_duration_days
  FROM public.offers
  WHERE id = v_offer.offer_id;

  IF v_offer.status::TEXT <> 'offered' AND v_offer.status::TEXT <> p_new_status THEN
    RAISE EXCEPTION 'This offer was already %. Refresh before changing it again.', v_offer.status;
  END IF;

  -- A same-decision retry intentionally keeps the original dates. It still
  -- reaches the lifecycle update below, so legacy partial state is repaired.
  IF v_offer.status::TEXT = 'offered' THEN
    v_transitioned := TRUE;
    IF p_new_status = 'accepted' THEN
      UPDATE public.repreneur_offers
      SET status = 'accepted',
          accepted_at = v_decided_at,
          expires_at = v_decided_at + make_interval(days => v_duration_days)
      WHERE id = p_repreneur_offer_id;
    ELSE
      UPDATE public.repreneur_offers
      SET status = 'declined',
          declined_at = v_decided_at
      WHERE id = p_repreneur_offer_id;
    END IF;
  END IF;

  IF p_new_status = 'accepted' THEN
    UPDATE public.repreneurs
    SET lifecycle_status = 'client'
    WHERE id = p_repreneur_id;
  ELSIF v_transitioned THEN
    UPDATE public.repreneurs
    SET lifecycle_status = 'declined',
        declined_at = v_decided_at,
        decline_reason_category = p_decline_reason_category,
        decline_reason_text = NULLIF(BTRIM(p_decline_reason_text), '')
    WHERE id = p_repreneur_id;
  ELSE
    UPDATE public.repreneurs
    SET lifecycle_status = 'declined',
        declined_at = COALESCE(declined_at, v_offer.declined_at)
    WHERE id = p_repreneur_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repreneur was not found.';
  END IF;

  RETURN QUERY
  SELECT ro.status::TEXT, ro.accepted_at, ro.expires_at, ro.declined_at
  FROM public.repreneur_offers ro
  WHERE ro.id = p_repreneur_offer_id;
END;
$$;


--
-- Name: update_external_pursuit("uuid", "text", "text", boolean, "text", boolean, "date", boolean, "text", boolean, "text", boolean, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_external_pursuit"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor_role public.app_user_role; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE); SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.event_type='updated' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key) THEN RETURN; END IF;
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'A title and idempotency key are required.'; END IF;
  IF actor_role <> 'staff' AND p_staff_notes_provided THEN RAISE EXCEPTION 'Only staff may change internal notes.'; END IF;
  UPDATE public.external_pursuits SET title=BTRIM(p_title),stage=CASE WHEN p_stage_provided THEN NULLIF(BTRIM(p_stage),'')::public.external_pursuit_stage ELSE stage END,availability=CASE WHEN p_availability_provided THEN NULLIF(BTRIM(p_availability),'')::public.external_pursuit_availability ELSE availability END,due_at=CASE WHEN p_due_at_provided THEN p_due_at ELSE due_at END,updated_by=actor,updated_at=clock_timestamp() WHERE id=p_dossier_id;
  IF p_shared_notes_provided THEN INSERT INTO public.external_pursuit_notes (external_pursuit_id,shared_notes,updated_by,updated_at) VALUES (p_dossier_id,NULLIF(BTRIM(p_shared_notes),''),actor,clock_timestamp()) ON CONFLICT (external_pursuit_id) DO UPDATE SET shared_notes=EXCLUDED.shared_notes,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at; END IF;
  IF p_staff_notes_provided THEN INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id,staff_internal_notes,updated_by,updated_at) VALUES (p_dossier_id,NULLIF(BTRIM(p_staff_internal_notes),''),actor,clock_timestamp()) ON CONFLICT (external_pursuit_id) DO UPDATE SET staff_internal_notes=EXCLUDED.staff_internal_notes,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at; END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'updated',actor,p_idempotency_key);
END $$;


--
-- Name: update_external_pursuit_follow_up("uuid", "text", boolean, "text", boolean, "text", boolean, "date", boolean, "text", boolean, "text", boolean, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_external_pursuit_follow_up"("p_dossier_id" "uuid", "p_next_action" "text", "p_next_action_provided" boolean, "p_responsible_party" "text", "p_responsible_party_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  dossier public.external_pursuits%ROWTYPE;
  actor_role public.app_user_role;
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  normalized_action TEXT := NULLIF(BTRIM(p_next_action), '');
  normalized_responsible TEXT := NULLIF(BTRIM(p_responsible_party), '');
  normalized_availability TEXT := NULLIF(BTRIM(p_availability), '');
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'An idempotency key is required.';
  END IF;
  IF p_next_action_provided IS DISTINCT FROM p_responsible_party_provided THEN
    RAISE EXCEPTION 'Next action and responsible party must be changed together.';
  END IF;
  IF p_next_action_provided AND (
    (normalized_action IS NULL AND normalized_responsible IS NOT NULL)
    OR (normalized_action IS NOT NULL AND normalized_responsible IS NULL)
  ) THEN
    RAISE EXCEPTION 'A next action requires one responsible party.';
  END IF;
  IF p_availability_provided AND normalized_availability IS NULL THEN
    RAISE EXCEPTION 'Availability is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);

  IF EXISTS (
    SELECT 1 FROM public.external_pursuit_audit_events audit
    WHERE audit.external_pursuit_id = p_dossier_id
      AND audit.event_type = 'updated'
      AND audit.actor_user_id = actor
      AND audit.idempotency_key = p_idempotency_key
  ) THEN
    RETURN;
  END IF;
  IF dossier.deletion_status <> 'active' THEN
    RAISE EXCEPTION 'External Pursuit is not editable.';
  END IF;
  IF actor_role <> 'staff' AND p_staff_notes_provided THEN
    RAISE EXCEPTION 'Only staff may change internal notes.';
  END IF;

  UPDATE public.external_pursuits pursuit
  SET next_action = CASE WHEN p_next_action_provided THEN normalized_action ELSE pursuit.next_action END,
      responsible_party = CASE
        WHEN p_responsible_party_provided THEN normalized_responsible::public.external_pursuit_responsible_party
        ELSE pursuit.responsible_party
      END,
      availability = CASE
        WHEN p_availability_provided THEN normalized_availability::public.external_pursuit_availability
        ELSE pursuit.availability
      END,
      due_at = CASE WHEN p_due_at_provided THEN p_due_at ELSE pursuit.due_at END,
      updated_by = actor,
      updated_at = clock_timestamp()
  WHERE pursuit.id = p_dossier_id;

  IF p_shared_notes_provided THEN
    INSERT INTO public.external_pursuit_notes (external_pursuit_id, shared_notes, updated_by, updated_at)
    VALUES (p_dossier_id, NULLIF(BTRIM(p_shared_notes), ''), actor, clock_timestamp())
    ON CONFLICT (external_pursuit_id) DO UPDATE
      SET shared_notes = EXCLUDED.shared_notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at;
  END IF;
  IF p_staff_notes_provided THEN
    INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id, staff_internal_notes, updated_by, updated_at)
    VALUES (p_dossier_id, NULLIF(BTRIM(p_staff_internal_notes), ''), actor, clock_timestamp())
    ON CONFLICT (external_pursuit_id) DO UPDATE
      SET staff_internal_notes = EXCLUDED.staff_internal_notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at;
  END IF;

  PERFORM public.external_pursuit_append_audit(
    p_dossier_id,
    'updated',
    actor,
    p_idempotency_key,
    jsonb_build_object(
      'follow_up', TRUE,
      'next_action_changed', p_next_action_provided,
      'responsible_party_changed', p_responsible_party_provided,
      'availability_changed', p_availability_provided,
      'due_at_changed', p_due_at_provided,
      'shared_notes_changed', p_shared_notes_provided,
      'staff_notes_changed', p_staff_notes_provided
    )
  );
END $$;


--
-- Name: update_external_pursuit_v2("uuid", "text", "text", boolean, "text", boolean, "date", boolean, "text", boolean, "text", boolean, "text", boolean, "text", boolean, "text", boolean, numeric, boolean, numeric, boolean, integer, boolean, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_external_pursuit_v2"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_external_url" "text", "p_external_url_provided" boolean, "p_target_company" "text", "p_target_company_provided" boolean, "p_source_channel" "text", "p_source_channel_provided" boolean, "p_revenue_meur" numeric, "p_revenue_meur_provided" boolean, "p_ebitda_keur" numeric, "p_ebitda_keur_provided" boolean, "p_headcount" integer, "p_headcount_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role;
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'External Pursuit title and idempotency key are required.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id = p_dossier_id AND a.event_type = 'updated' AND a.actor_user_id = actor AND a.idempotency_key = p_idempotency_key) THEN RETURN; END IF;
  IF actor_role <> 'staff' AND p_staff_notes_provided THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  UPDATE public.external_pursuits SET
    title = BTRIM(p_title),
    stage = CASE WHEN p_stage_provided THEN NULLIF(BTRIM(p_stage), '')::public.external_pursuit_stage ELSE stage END,
    availability = CASE WHEN p_availability_provided THEN NULLIF(BTRIM(p_availability), '')::public.external_pursuit_availability ELSE availability END,
    due_at = CASE WHEN p_due_at_provided THEN p_due_at ELSE due_at END,
    external_url = CASE WHEN p_external_url_provided THEN NULLIF(BTRIM(p_external_url), '') ELSE external_url END,
    target_company = CASE WHEN p_target_company_provided THEN NULLIF(BTRIM(p_target_company), '') ELSE target_company END,
    source_channel = CASE WHEN p_source_channel_provided THEN NULLIF(BTRIM(p_source_channel), '') ELSE source_channel END,
    revenue_meur = CASE WHEN p_revenue_meur_provided THEN p_revenue_meur ELSE revenue_meur END,
    ebitda_keur = CASE WHEN p_ebitda_keur_provided THEN p_ebitda_keur ELSE ebitda_keur END,
    headcount = CASE WHEN p_headcount_provided THEN p_headcount ELSE headcount END,
    updated_by = actor, updated_at = clock_timestamp()
    WHERE id = p_dossier_id;
  IF p_shared_notes_provided THEN
    INSERT INTO public.external_pursuit_notes (external_pursuit_id, shared_notes, updated_by, updated_at)
      VALUES (p_dossier_id, NULLIF(BTRIM(p_shared_notes), ''), actor, clock_timestamp())
      ON CONFLICT (external_pursuit_id) DO UPDATE SET shared_notes = EXCLUDED.shared_notes, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;
  IF p_staff_notes_provided THEN
    INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id, staff_internal_notes, updated_by, updated_at)
      VALUES (p_dossier_id, NULLIF(BTRIM(p_staff_internal_notes), ''), actor, clock_timestamp())
      ON CONFLICT (external_pursuit_id) DO UPDATE SET staff_internal_notes = EXCLUDED.staff_internal_notes, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id, 'updated', actor, p_idempotency_key);
END $$;


--
-- Name: update_journey_stage_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_journey_stage_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  g1_complete BOOLEAN;
  g2_complete BOOLEAN;
  g3_any BOOLEAN;
  g3_complete BOOLEAN;
  g4_complete BOOLEAN;
BEGIN
  NEW.tier3_milestone_count := (
    CASE WHEN NEW.ms_decision_to_pursue THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_availability_confirmed THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_target_profile_sheet THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_pitch_plan THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_equity_range THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_deal_breakers THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_leadership_assessment_passed THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_advisory_team_identified THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_intermediary_meeting THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_seller_meeting THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_loi_issued THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_due_diligence THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_negotiation THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_financing_validated THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_closing THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_plan_100_days THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_plan_3_years THEN 1 ELSE 0 END
  );

  g1_complete := NEW.ms_decision_to_pursue AND NEW.ms_availability_confirmed;

  g2_complete := g1_complete
    AND NEW.ms_target_profile_sheet AND NEW.ms_pitch_plan
    AND NEW.ms_equity_range AND NEW.ms_deal_breakers
    AND NEW.ms_leadership_assessment_passed AND NEW.ms_advisory_team_identified;

  g3_any := g2_complete AND (
    NEW.ms_intermediary_meeting OR NEW.ms_seller_meeting OR NEW.ms_loi_issued
    OR NEW.ms_due_diligence OR NEW.ms_negotiation OR NEW.ms_financing_validated
    OR NEW.ms_closing
  );

  g3_complete := g2_complete AND NEW.ms_intermediary_meeting AND NEW.ms_seller_meeting
    AND NEW.ms_loi_issued AND NEW.ms_due_diligence AND NEW.ms_negotiation
    AND NEW.ms_financing_validated AND NEW.ms_closing;

  g4_complete := g3_complete AND NEW.ms_plan_100_days AND NEW.ms_plan_3_years;

  IF g4_complete THEN
    NEW.journey_stage := 'post_acquisition';
  ELSIF g3_any THEN
    NEW.journey_stage := 'execution';
  ELSIF g2_complete THEN
    NEW.journey_stage := 'ready';
  ELSIF g1_complete THEN
    NEW.journey_stage := 'learner';
  ELSE
    NEW.journey_stage := 'explorer';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_ma_cutover_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_ma_cutover_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_tasks_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_tasks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: upsert_clipboard("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."upsert_clipboard"("slug_param" "text", "title_param" "text", "html_param" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN IF slug_param NOT IN ('scrapbook','scrapbook-html-1','scrapbook-html-2','scrapbook-html-3','scrapbook-html-4','scrapbook-html-5','scrapbook-html-6','scrapbook-html-7','scrapbook-html-8','scrapbook-html-9','scrapbook-html-10') THEN RAISE EXCEPTION 'slug not in allowlist: %', slug_param; END IF; INSERT INTO public.clipboard (slug, title, html_content, created_at) VALUES (slug_param, title_param, html_param, now()) ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, html_content = EXCLUDED.html_content, created_at = now(); END; $$;


--
-- Name: validate_geography_node_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_geography_node_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE parent_level TEXT;
BEGIN
  IF NEW.node_level = 'country' THEN
    IF NEW.parent_id IS NOT NULL THEN RAISE EXCEPTION 'geography_country_cannot_have_parent'; END IF;
    RETURN NEW;
  END IF;
  SELECT node_level INTO parent_level FROM public.geography_nodes WHERE id = NEW.parent_id;
  IF parent_level IS NULL THEN RAISE EXCEPTION 'geography_parent_not_found'; END IF;
  IF (NEW.node_level = 'macro_zone' AND parent_level <> 'country')
     OR (NEW.node_level = 'region' AND parent_level <> 'macro_zone') THEN
    RAISE EXCEPTION 'geography_parent_level_invalid';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_w098_date_precision_write("uuid", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_w098_date_precision_write"("p_opportunity_id" "uuid", "p_opportunity_fields" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE current_precision TEXT; requested_date TEXT; confirm_day BOOLEAN := FALSE;
BEGIN
  IF JSONB_TYPEOF(COALESCE(p_opportunity_fields, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'opportunity_intake_fields_must_be_object';
  END IF;
  IF p_opportunity_fields ? 'date_added_confirm_day' THEN
    IF JSONB_TYPEOF(p_opportunity_fields -> 'date_added_confirm_day') <> 'boolean' THEN
      RAISE EXCEPTION 'opportunity_date_added_confirmation_must_be_boolean';
    END IF;
    confirm_day := (p_opportunity_fields ->> 'date_added_confirm_day')::BOOLEAN;
  END IF;
  SELECT date_added_precision INTO current_precision
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  requested_date := NULLIF(BTRIM(p_opportunity_fields ->> 'date_added'), '');
  IF current_precision = 'month' THEN
    IF confirm_day AND requested_date IS NULL THEN
      RAISE EXCEPTION 'opportunity_date_added_confirmation_requires_day';
    END IF;
    IF requested_date IS NOT NULL AND NOT confirm_day THEN
      RAISE EXCEPTION 'opportunity_date_added_month_precision_requires_confirmation';
    END IF;
  ELSIF confirm_day AND requested_date IS NULL THEN
    RAISE EXCEPTION 'opportunity_date_added_confirmation_requires_day';
  END IF;
  RETURN confirm_day;
END $$;


--
-- Name: verify_ma_interaction_owner("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."verify_ma_interaction_owner"("p_interaction_id" "uuid", "p_actor" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  interaction_owner TEXT;
  interaction_state TEXT;
  actor_is_staff BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_owner_verification_requires_actor';
  END IF;

  SELECT owner_staff_user_id, owner_verification_state
  INTO interaction_owner, interaction_state
  FROM public.ma_interactions
  WHERE id = p_interaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_interaction_not_found';
  END IF;
  IF interaction_state <> 'provisional' THEN
    RAISE EXCEPTION 'ma_interaction_owner_already_verified';
  END IF;
  IF interaction_owner IS DISTINCT FROM BTRIM(p_actor) THEN
    RAISE EXCEPTION 'ma_interaction_owner_must_verify_self';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.app_user_roles role
    WHERE role.role = 'staff'
      AND role.user_id = BTRIM(p_actor)
  ) INTO actor_is_staff;

  IF NOT actor_is_staff THEN
    RAISE EXCEPTION 'ma_interaction_owner_verification_requires_staff_actor';
  END IF;

  PERFORM set_config('app.ma_interaction_owner_verification', 'true', true);
  UPDATE public.ma_interactions
  SET owner_verification_state = 'verified',
      owner_verified_by = BTRIM(p_actor),
      owner_verified_at = NOW()
  WHERE id = p_interaction_id;

  INSERT INTO public.ma_interaction_owner_verification_events (
    interaction_id, owner_staff_user_id, verified_by, previous_state, resulting_state
  ) VALUES (
    p_interaction_id, interaction_owner, BTRIM(p_actor), 'provisional', 'verified'
  );

  RETURN TRUE;
END;
$$;


--
-- Name: wave_journey_guard_opportunity_lifecycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."wave_journey_guard_opportunity_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE r RECORD; BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status='active' THEN RETURN NEW; END IF;
 IF NEW.status IN ('closed','archived') AND EXISTS(SELECT 1 FROM public.opportunity_matches WHERE opportunity_id=NEW.id AND status='active_pursuit') AND current_setting('wave.journey_terminal_transition',true) IS DISTINCT FROM 'on' THEN
   RAISE EXCEPTION 'Active pursuit must be dropped or completed through the canonical journey before closing or archiving the opportunity.';
 END IF;
 FOR r IN SELECT id FROM public.opportunity_matches WHERE opportunity_id=NEW.id AND status='active_pursuit' LOOP
   UPDATE public.opportunity_pursuit_confidential_grants SET revoked_at=NOW(),revoked_by='system:opportunity-status',revoked_reason='opportunity_'||NEW.status WHERE match_id=r.id AND revoked_at IS NULL;
   IF FOUND THEN
     INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,evidence_reference,idempotency_key,metadata)
     SELECT m.id,m.opportunity_id,m.repreneur_id,'access_revoked','system:opportunity-status','opportunity status changed to '||NEW.status,'opportunity-status:'||NEW.id::TEXT||':'||NEW.status||':'||r.id::TEXT||':'||COALESCE((SELECT source_disclosed_at::TEXT FROM public.opportunity_pursuit_confidential_grants WHERE match_id=r.id),'unknown'),jsonb_build_object('cycle_started_evidence_id',public.journey_current_cycle_event(r.id)) FROM public.opportunity_matches m WHERE m.id=r.id
     ON CONFLICT(match_id,idempotency_key) DO NOTHING;
   END IF;
 END LOOP;
 RETURN NEW;
END $$;


--
-- Name: wave_journey_guard_repreneur_artifact_origin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."wave_journey_guard_repreneur_artifact_origin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.artifact_role='repreneur_signed_copy' AND current_setting('wave.journey_portal_repreneur_upload',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Repreneur signed copies may be submitted only by the active repreneur after Gate 1.';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: wave_journey_is_enabled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."wave_journey_is_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE((SELECT enabled FROM public.wave_journey_settings WHERE singleton), FALSE)
$$;


--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."account" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "providerId" "text" NOT NULL,
    "accessToken" "text",
    "refreshToken" "text",
    "accessTokenExpiresAt" timestamp without time zone,
    "refreshTokenExpiresAt" timestamp without time zone,
    "scope" "text",
    "idToken" "text",
    "password" "text",
    "createdAt" timestamp without time zone DEFAULT "now"(),
    "updatedAt" timestamp without time zone DEFAULT "now"()
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "notes" "text",
    "duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    "event_date" "date",
    CONSTRAINT "activities_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['welcome_email'::"text", 'interview'::"text", 'offer_submitted'::"text", 'offer_rejected'::"text", 'offer_approved'::"text", 'meeting'::"text"])))
);


--
-- Name: ai_generation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ai_generation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generation_id" "uuid" NOT NULL,
    "actor_user_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "reason_code" "text" DEFAULT ''::"text" NOT NULL,
    "action_key" "text" DEFAULT ''::"text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_generation_events_action_key_check" CHECK (("char_length"("action_key") <= 80)),
    CONSTRAINT "ai_generation_events_actor_user_id_check" CHECK ((("char_length"("actor_user_id") >= 1) AND ("char_length"("actor_user_id") <= 160))),
    CONSTRAINT "ai_generation_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['rendered'::"text", 'edit_started'::"text", 'copied'::"text", 'send_review_opened'::"text", 'send_succeeded'::"text", 'send_failed'::"text", 'workflow_action_confirmed'::"text", 'feedback_helpful'::"text", 'feedback_not_helpful'::"text", 'discarded'::"text"]))),
    CONSTRAINT "ai_generation_events_reason_code_check" CHECK (("reason_code" = ANY (ARRAY[''::"text", 'wrong_fact'::"text", 'not_relevant'::"text", 'poor_wording'::"text", 'missing_context'::"text", 'other_without_text'::"text"])))
);

ALTER TABLE ONLY "public"."ai_generation_events" FORCE ROW LEVEL SECURITY;


--
-- Name: ai_generation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ai_generation_runs" (
    "generation_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trace_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "initiated_by_user_id" "text" NOT NULL,
    "app_role" "text" NOT NULL,
    "feature" "text" NOT NULL,
    "workflow" "text" NOT NULL,
    "surface" "text" NOT NULL,
    "prompt_version" "text" NOT NULL,
    "output_schema_version" "text" NOT NULL,
    "provider" "text" DEFAULT 'openai'::"text" NOT NULL,
    "model" "text" DEFAULT 'gpt-5.6-luna'::"text" NOT NULL,
    "reasoning_effort" "text" DEFAULT 'max'::"text" NOT NULL,
    "pricing_version" "text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "error_code" "text" DEFAULT ''::"text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "cached_input_tokens" integer DEFAULT 0 NOT NULL,
    "cache_write_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "reasoning_tokens" integer DEFAULT 0 NOT NULL,
    "estimated_cost_usd" numeric(14,8) DEFAULT 0 NOT NULL,
    "latency_ms" integer,
    "environment" "text" NOT NULL,
    "release" "text" DEFAULT ''::"text" NOT NULL,
    "is_test" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_generation_runs_app_role_check" CHECK (("app_role" = 'staff'::"text")),
    CONSTRAINT "ai_generation_runs_cache_write_tokens_check" CHECK (("cache_write_tokens" >= 0)),
    CONSTRAINT "ai_generation_runs_cached_input_tokens_check" CHECK (("cached_input_tokens" >= 0)),
    CONSTRAINT "ai_generation_runs_check" CHECK (((("status" = 'requested'::"text") AND ("completed_at" IS NULL)) OR (("status" = ANY (ARRAY['succeeded'::"text", 'failed'::"text"])) AND ("completed_at" IS NOT NULL)))),
    CONSTRAINT "ai_generation_runs_environment_check" CHECK (("environment" = ANY (ARRAY['development'::"text", 'preview'::"text", 'production'::"text", 'test'::"text"]))),
    CONSTRAINT "ai_generation_runs_error_code_check" CHECK (("char_length"("error_code") <= 80)),
    CONSTRAINT "ai_generation_runs_estimated_cost_usd_check" CHECK (("estimated_cost_usd" >= (0)::numeric)),
    CONSTRAINT "ai_generation_runs_feature_check" CHECK (("feature" = ANY (ARRAY['email_draft'::"text", 'next_action'::"text", 'match_review'::"text"]))),
    CONSTRAINT "ai_generation_runs_initiated_by_user_id_check" CHECK ((("char_length"("initiated_by_user_id") >= 1) AND ("char_length"("initiated_by_user_id") <= 160))),
    CONSTRAINT "ai_generation_runs_input_tokens_check" CHECK (("input_tokens" >= 0)),
    CONSTRAINT "ai_generation_runs_latency_ms_check" CHECK ((("latency_ms" IS NULL) OR ("latency_ms" >= 0))),
    CONSTRAINT "ai_generation_runs_model_check" CHECK (("model" = 'gpt-5.6-luna'::"text")),
    CONSTRAINT "ai_generation_runs_output_schema_version_check" CHECK ((("char_length"("output_schema_version") >= 1) AND ("char_length"("output_schema_version") <= 80))),
    CONSTRAINT "ai_generation_runs_output_tokens_check" CHECK (("output_tokens" >= 0)),
    CONSTRAINT "ai_generation_runs_pricing_version_check" CHECK ((("char_length"("pricing_version") >= 1) AND ("char_length"("pricing_version") <= 40))),
    CONSTRAINT "ai_generation_runs_prompt_version_check" CHECK ((("char_length"("prompt_version") >= 1) AND ("char_length"("prompt_version") <= 80))),
    CONSTRAINT "ai_generation_runs_provider_check" CHECK (("provider" = 'openai'::"text")),
    CONSTRAINT "ai_generation_runs_reasoning_effort_check" CHECK (("reasoning_effort" = 'max'::"text")),
    CONSTRAINT "ai_generation_runs_reasoning_tokens_check" CHECK (("reasoning_tokens" >= 0)),
    CONSTRAINT "ai_generation_runs_release_check" CHECK (("char_length"("release") <= 80)),
    CONSTRAINT "ai_generation_runs_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'succeeded'::"text", 'failed'::"text"]))),
    CONSTRAINT "ai_generation_runs_surface_check" CHECK ((("char_length"("surface") >= 1) AND ("char_length"("surface") <= 120))),
    CONSTRAINT "ai_generation_runs_workflow_check" CHECK ((("char_length"("workflow") >= 1) AND ("char_length"("workflow") <= 80)))
);

ALTER TABLE ONLY "public"."ai_generation_runs" FORCE ROW LEVEL SECURITY;


--
-- Name: app_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."app_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "email" "text" NOT NULL,
    "role" "public"."app_user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "repreneur_id" "uuid",
    "access_enabled_at" timestamp with time zone,
    "last_access_email_sent_at" timestamp with time zone
);


--
-- Name: clipboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."clipboard" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "html_content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: email_daily_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."email_daily_counts" (
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "template_key" "text" NOT NULL,
    "resend_id" "text",
    "to_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" "text",
    "daily_counted_at" timestamp with time zone,
    "provider_attempted_at" timestamp with time zone,
    "provider_outcome" "text",
    CONSTRAINT "email_logs_provider_outcome_check" CHECK ((("provider_outcome" IS NULL) OR ("provider_outcome" = ANY (ARRAY['attempting'::"text", 'uncertain'::"text", 'rejected'::"text", 'accepted'::"text"])))),
    CONSTRAINT "email_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'opened'::"text", 'clicked'::"text", 'bounced'::"text", 'failed'::"text", 'complained'::"text"])))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "requires_consent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body_markdown" "text",
    "body_editable" boolean DEFAULT false NOT NULL
);


--
-- Name: evaluation_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."evaluation_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier" "text" NOT NULL,
    "question_key" "text" NOT NULL,
    "question_label" "text" NOT NULL,
    "question_order" integer NOT NULL,
    "option_value" "text",
    "option_label" "text",
    "option_score" numeric(5,2),
    "option_order" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "evaluation_criteria_tier_check" CHECK (("tier" = ANY (ARRAY['tier1'::"text", 'tier2'::"text", 'tier3'::"text"]))),
    CONSTRAINT "score_range" CHECK ((("option_score" IS NULL) OR (("option_score" >= (0)::numeric) AND ("option_score" <= (20)::numeric))))
);


--
-- Name: external_pursuit_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_pursuit_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "byte_size" bigint NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "external_pursuit_attachment_path_matches_dossier" CHECK ((("storage_path" ~ '^[0-9a-f-]{36}/[0-9a-f]{64}\.[a-z0-9]{2,5}$'::"text") AND (("split_part"("storage_path", '/'::"text", 1))::"uuid" = "external_pursuit_id"))),
    CONSTRAINT "external_pursuit_attachments_byte_size_check" CHECK ((("byte_size" > 0) AND ("byte_size" <= 20971520))),
    CONSTRAINT "external_pursuit_attachments_content_type_check" CHECK (("content_type" = ANY (ARRAY['application/pdf'::"text", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::"text", 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::"text", 'text/csv'::"text", 'image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'image/gif'::"text"]))),
    CONSTRAINT "external_pursuit_attachments_created_by_check" CHECK ((NULLIF("btrim"("created_by"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuit_attachments_original_filename_check" CHECK ((("char_length"("original_filename") >= 1) AND ("char_length"("original_filename") <= 255)))
);

ALTER TABLE ONLY "public"."external_pursuit_attachments" FORCE ROW LEVEL SECURITY;


--
-- Name: external_pursuit_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_pursuit_id" "uuid" NOT NULL,
    "event_type" "public"."external_pursuit_audit_event_type" NOT NULL,
    "actor_user_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "external_pursuit_audit_events_actor_user_id_check" CHECK ((NULLIF("btrim"("actor_user_id"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuit_audit_events_idempotency_key_check" CHECK ((NULLIF("btrim"("idempotency_key"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuit_audit_events_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text"))
);

ALTER TABLE ONLY "public"."external_pursuit_audit_events" FORCE ROW LEVEL SECURITY;


--
-- Name: external_pursuit_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_pursuit_id" "uuid" NOT NULL,
    "name" "text",
    "organisation" "text",
    "role_title" "text",
    "email" "text",
    "phone" "text",
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_by" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "external_pursuit_contacts_check" CHECK (((NULLIF("btrim"("name"), ''::"text") IS NOT NULL) OR (NULLIF("btrim"("organisation"), ''::"text") IS NOT NULL))),
    CONSTRAINT "external_pursuit_contacts_created_by_check" CHECK ((NULLIF("btrim"("created_by"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuit_contacts_updated_by_check" CHECK ((NULLIF("btrim"("updated_by"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."external_pursuit_contacts" FORCE ROW LEVEL SECURITY;


--
-- Name: external_pursuit_deletion_tombstones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_deletion_tombstones" (
    "former_dossier_id" "uuid" NOT NULL,
    "owner_repreneur_id" "uuid" NOT NULL,
    "deletion_requested_by" "text" NOT NULL,
    "deletion_requested_at" timestamp with time zone NOT NULL,
    "deletion_fulfilled_by" "text" NOT NULL,
    "deletion_fulfilled_at" timestamp with time zone NOT NULL,
    "fulfillment_idempotency_key" "text" NOT NULL
);

ALTER TABLE ONLY "public"."external_pursuit_deletion_tombstones" FORCE ROW LEVEL SECURITY;


--
-- Name: external_pursuit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_notes" (
    "external_pursuit_id" "uuid" NOT NULL,
    "shared_notes" "text",
    "updated_by" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "external_pursuit_notes_updated_by_check" CHECK ((NULLIF("btrim"("updated_by"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."external_pursuit_notes" FORCE ROW LEVEL SECURITY;


--
-- Name: external_pursuit_opportunity_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_opportunity_conversions" (
    "external_pursuit_id" "uuid" NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "converted_by" "text" NOT NULL,
    "converted_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "idempotency_key" "text" NOT NULL,
    CONSTRAINT "external_pursuit_opportunity_conversions_converted_by_check" CHECK ((NULLIF("btrim"("converted_by"), ''::"text") IS NOT NULL)),
    CONSTRAINT "external_pursuit_opportunity_conversions_idempotency_key_check" CHECK ((NULLIF("btrim"("idempotency_key"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."external_pursuit_opportunity_conversions" FORCE ROW LEVEL SECURITY;


--
-- Name: external_pursuit_staff_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."external_pursuit_staff_notes" (
    "external_pursuit_id" "uuid" NOT NULL,
    "staff_internal_notes" "text",
    "updated_by" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "external_pursuit_staff_notes_updated_by_check" CHECK ((NULLIF("btrim"("updated_by"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."external_pursuit_staff_notes" FORCE ROW LEVEL SECURITY;


--
-- Name: intake_abandonment_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."intake_abandonment_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "last_step_completed" integer DEFAULT 1 NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reminder_sent_at" timestamp with time zone,
    "reminder_count" integer DEFAULT 0,
    "is_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: leadership_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."leadership_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "a1" "text",
    "a2" "text",
    "a3" "text",
    "a4" "text",
    "a5" "text",
    "a6" "text",
    "a7" "text",
    "a8" "text",
    "a9" "text",
    "a10" "text",
    "b1" "text",
    "b2" "text",
    "b3" "text",
    "b4" "text",
    "b5" "text",
    "b6" "text",
    "b7" "text",
    "b8" "text",
    "c1" integer,
    "c2" integer,
    "c3" integer,
    "c4" integer,
    "c5" integer,
    "c6" integer,
    "c7" integer,
    "c8" integer,
    "bloc_a_radar" "jsonb",
    "bloc_b_total" integer,
    "bloc_b_tags" "jsonb",
    "bloc_b_minus2_count" integer,
    "bloc_c_risk_index" numeric(3,1),
    "decision" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_by" "text",
    CONSTRAINT "leadership_assessments_a10_check" CHECK (("a10" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a1_check" CHECK (("a1" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a2_check" CHECK (("a2" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a3_check" CHECK (("a3" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a4_check" CHECK (("a4" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a5_check" CHECK (("a5" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a6_check" CHECK (("a6" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a7_check" CHECK (("a7" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a8_check" CHECK (("a8" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_a9_check" CHECK (("a9" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "leadership_assessments_b1_check" CHECK (("b1" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b2_check" CHECK (("b2" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b3_check" CHECK (("b3" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b4_check" CHECK (("b4" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b5_check" CHECK (("b5" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b6_check" CHECK (("b6" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b7_check" CHECK (("b7" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_b8_check" CHECK (("b8" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "leadership_assessments_c1_check" CHECK ((("c1" >= 1) AND ("c1" <= 5))),
    CONSTRAINT "leadership_assessments_c2_check" CHECK ((("c2" >= 1) AND ("c2" <= 5))),
    CONSTRAINT "leadership_assessments_c3_check" CHECK ((("c3" >= 1) AND ("c3" <= 5))),
    CONSTRAINT "leadership_assessments_c4_check" CHECK ((("c4" >= 1) AND ("c4" <= 5))),
    CONSTRAINT "leadership_assessments_c5_check" CHECK ((("c5" >= 1) AND ("c5" <= 5))),
    CONSTRAINT "leadership_assessments_c6_check" CHECK ((("c6" >= 1) AND ("c6" <= 5))),
    CONSTRAINT "leadership_assessments_c7_check" CHECK ((("c7" >= 1) AND ("c7" <= 5))),
    CONSTRAINT "leadership_assessments_c8_check" CHECK ((("c8" >= 1) AND ("c8" <= 5))),
    CONSTRAINT "leadership_assessments_decision_check" CHECK (("decision" = ANY (ARRAY['engagement'::"text", 'engagement_sous_conditions'::"text", 'non_engagement'::"text"])))
);


--
-- Name: ma_contact_email_policy_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_contact_email_policy_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "previous_suppressed" boolean,
    "resulting_suppressed" boolean,
    "purpose" "public"."ma_contact_email_purpose",
    "opportunity_id" "uuid",
    "actor" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "operation_key" "uuid",
    "source_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_contact_email_policy_events_actor_check" CHECK ((NULLIF("btrim"("actor"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_contact_email_policy_events_check" CHECK (((("event_type" = ANY (ARRAY['suppression_enabled'::"text", 'suppression_removed'::"text"])) AND ("previous_suppressed" IS NOT NULL) AND ("resulting_suppressed" IS NOT NULL) AND ("previous_suppressed" IS DISTINCT FROM "resulting_suppressed") AND ("purpose" IS NULL) AND ("opportunity_id" IS NULL) AND ("operation_key" IS NULL)) OR (("event_type" = 'allowlisted_operational_send'::"text") AND ("previous_suppressed" IS NULL) AND ("resulting_suppressed" IS NULL) AND ("purpose" = 'opportunity_nda_request'::"public"."ma_contact_email_purpose") AND ("opportunity_id" IS NOT NULL) AND ("operation_key" IS NOT NULL) AND ("source_key" IS NULL)))),
    CONSTRAINT "ma_contact_email_policy_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['suppression_enabled'::"text", 'suppression_removed'::"text", 'allowlisted_operational_send'::"text"]))),
    CONSTRAINT "ma_contact_email_policy_events_reason_check" CHECK ((NULLIF("btrim"("reason"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."ma_contact_email_policy_events" FORCE ROW LEVEL SECURITY;


--
-- Name: ma_contact_office_affiliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_contact_office_affiliations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "office_id" "uuid" NOT NULL,
    "legacy_source_contact_id" "uuid",
    "legacy_source_id" "uuid",
    "job_title" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "started_at" "date",
    "ended_at" "date",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_contact_office_affiliations_check" CHECK ((("is_active" AND ("ended_at" IS NULL)) OR ((NOT "is_active") AND ("ended_at" IS NOT NULL))))
);


--
-- Name: ma_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_source_contact_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "display_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "email" "text",
    "phone" "text",
    "linkedin_url" "text",
    "internal_notes" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_by" "text",
    "archived_at" timestamp with time zone,
    "campaign_email_suppressed" boolean DEFAULT false NOT NULL,
    "campaign_email_suppression_reason" "text",
    CONSTRAINT "ma_contacts_campaign_email_suppression_reason_check" CHECK ((("campaign_email_suppressed" AND (NULLIF("btrim"("campaign_email_suppression_reason"), ''::"text") IS NOT NULL)) OR ((NOT "campaign_email_suppressed") AND ("campaign_email_suppression_reason" IS NULL)))),
    CONSTRAINT "ma_contacts_check" CHECK (((NULLIF("btrim"("first_name"), ''::"text") IS NOT NULL) OR (NULLIF("btrim"("last_name"), ''::"text") IS NOT NULL))),
    CONSTRAINT "ma_contacts_check1" CHECK ((("status" <> 'archived'::"text") OR ("archived_at" IS NOT NULL))),
    CONSTRAINT "ma_contacts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


--
-- Name: ma_cutover_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_cutover_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "source_fingerprint" "text" NOT NULL,
    "source_hash" "text" NOT NULL,
    "reconciliation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "review_decisions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "approval_digest" "text",
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_by" "text",
    "approved_at" timestamp with time zone,
    "activation_actor" "text",
    "activation_started_at" timestamp with time zone,
    "activated_by" "text",
    "activated_at" timestamp with time zone,
    "superseded_by" "text",
    "superseded_at" timestamp with time zone,
    "result_summary" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_cutover_runs_activated_by_check" CHECK ((("activated_by" IS NULL) OR (("char_length"("activated_by") >= 1) AND ("char_length"("activated_by") <= 200)))),
    CONSTRAINT "ma_cutover_runs_activation_actor_check" CHECK ((("activation_actor" IS NULL) OR (("char_length"("activation_actor") >= 1) AND ("char_length"("activation_actor") <= 200)))),
    CONSTRAINT "ma_cutover_runs_approval_digest_check" CHECK ((("approval_digest" IS NULL) OR ("approval_digest" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "ma_cutover_runs_approved_by_check" CHECK ((("approved_by" IS NULL) OR (("char_length"("approved_by") >= 1) AND ("char_length"("approved_by") <= 200)))),
    CONSTRAINT "ma_cutover_runs_check" CHECK ((("status" <> ALL (ARRAY['approved'::"text", 'activating'::"text", 'activated'::"text"])) OR ((NULLIF("btrim"("approval_digest"), ''::"text") IS NOT NULL) AND (NULLIF("btrim"("approved_by"), ''::"text") IS NOT NULL) AND ("approved_at" IS NOT NULL)))),
    CONSTRAINT "ma_cutover_runs_check1" CHECK ((("status" <> 'activated'::"text") OR ((NULLIF("btrim"("activated_by"), ''::"text") IS NOT NULL) AND ("activated_at" IS NOT NULL) AND ("result_summary" IS NOT NULL)))),
    CONSTRAINT "ma_cutover_runs_check2" CHECK (((("activation_actor" IS NULL) AND ("activation_started_at" IS NULL)) OR ("status" = ANY (ARRAY['activating'::"text", 'activated'::"text"])))),
    CONSTRAINT "ma_cutover_runs_check3" CHECK (((("activated_by" IS NULL) AND ("activated_at" IS NULL) AND ("result_summary" IS NULL)) OR ("status" = 'activated'::"text"))),
    CONSTRAINT "ma_cutover_runs_check4" CHECK ((("status" <> 'superseded'::"text") OR ((NULLIF("btrim"("superseded_by"), ''::"text") IS NOT NULL) AND ("superseded_at" IS NOT NULL)))),
    CONSTRAINT "ma_cutover_runs_check5" CHECK (((("superseded_by" IS NULL) AND ("superseded_at" IS NULL)) OR ("status" = 'superseded'::"text"))),
    CONSTRAINT "ma_cutover_runs_created_by_check" CHECK ((("char_length"("created_by") >= 1) AND ("char_length"("created_by") <= 200))),
    CONSTRAINT "ma_cutover_runs_reconciliation_summary_check" CHECK ("public"."ma_cutover_reconciliation_is_sanitized"("reconciliation_summary")),
    CONSTRAINT "ma_cutover_runs_result_summary_check" CHECK ((("result_summary" IS NULL) OR "public"."ma_cutover_result_is_sanitized"("result_summary"))),
    CONSTRAINT "ma_cutover_runs_review_decisions_check" CHECK ("public"."ma_cutover_review_decisions_are_sanitized"("review_decisions")),
    CONSTRAINT "ma_cutover_runs_source_fingerprint_check" CHECK ((("char_length"("source_fingerprint") = 71) AND ("source_fingerprint" ~ '^sha256:[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "ma_cutover_runs_source_hash_check" CHECK ((("char_length"("source_hash") = 64) AND ("source_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "ma_cutover_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'staged'::"text", 'review_required'::"text", 'approved'::"text", 'activating'::"text", 'activated'::"text", 'superseded'::"text"]))),
    CONSTRAINT "ma_cutover_runs_superseded_by_check" CHECK ((("superseded_by" IS NULL) OR (("char_length"("superseded_by") >= 1) AND ("char_length"("superseded_by") <= 200))))
);


--
-- Name: ma_cutover_stage_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_cutover_stage_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "stage_row_id" "uuid",
    "severity" "text" NOT NULL,
    "code" "text" NOT NULL,
    "field_name" "text",
    "message" "text" NOT NULL,
    "resolution_note" "text",
    "resolved_by" "text",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_cutover_stage_issues_check" CHECK (((("resolved_at" IS NULL) AND ("resolved_by" IS NULL)) OR (("resolved_at" IS NOT NULL) AND (NULLIF("btrim"("resolved_by"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "ma_cutover_stage_issues_code_check" CHECK (((NULLIF("btrim"("code"), ''::"text") IS NOT NULL) AND ("char_length"("code") <= 128))),
    CONSTRAINT "ma_cutover_stage_issues_field_name_check" CHECK ((("field_name" IS NULL) OR ("char_length"("field_name") <= 128))),
    CONSTRAINT "ma_cutover_stage_issues_message_check" CHECK (((NULLIF("btrim"("message"), ''::"text") IS NOT NULL) AND ("char_length"("message") <= 1000))),
    CONSTRAINT "ma_cutover_stage_issues_resolution_note_check" CHECK ((("resolution_note" IS NULL) OR ("char_length"("resolution_note") <= 2000))),
    CONSTRAINT "ma_cutover_stage_issues_resolved_by_check" CHECK ((("resolved_by" IS NULL) OR ("char_length"("resolved_by") <= 200))),
    CONSTRAINT "ma_cutover_stage_issues_severity_check" CHECK (("severity" = ANY (ARRAY['blocker'::"text", 'warning'::"text"])))
);


--
-- Name: ma_cutover_stage_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_cutover_stage_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "entity_kind" "text" NOT NULL,
    "resolution_action" "text" NOT NULL,
    "reuse_canonical_id" "uuid",
    "temporary_entity_id" "text" NOT NULL,
    "parent_temporary_entity_id" "text",
    "related_temporary_entity_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_row_locator" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "normalized_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_cutover_stage_rows_check" CHECK ("public"."ma_cutover_payload_is_sanitized"("entity_kind", "normalized_payload")),
    CONSTRAINT "ma_cutover_stage_rows_check1" CHECK (((("resolution_action" = 'create'::"text") AND ("reuse_canonical_id" IS NULL)) OR (("resolution_action" = 'reuse'::"text") AND ("reuse_canonical_id" IS NOT NULL)))),
    CONSTRAINT "ma_cutover_stage_rows_check2" CHECK ((("entity_kind" <> 'opportunity'::"text") OR ("resolution_action" = 'create'::"text"))),
    CONSTRAINT "ma_cutover_stage_rows_entity_kind_check" CHECK (("entity_kind" = ANY (ARRAY['firm'::"text", 'office'::"text", 'contact'::"text", 'affiliation'::"text", 'opportunity'::"text"]))),
    CONSTRAINT "ma_cutover_stage_rows_parent_temporary_entity_id_check" CHECK ((("parent_temporary_entity_id" IS NULL) OR ("parent_temporary_entity_id" ~ '^[A-Za-z0-9][-A-Za-z0-9._:/@+]{0,159}$'::"text"))),
    CONSTRAINT "ma_cutover_stage_rows_related_temporary_entity_ids_check" CHECK ("public"."ma_cutover_related_ids_are_bounded"("related_temporary_entity_ids")),
    CONSTRAINT "ma_cutover_stage_rows_resolution_action_check" CHECK (("resolution_action" = ANY (ARRAY['create'::"text", 'reuse'::"text"]))),
    CONSTRAINT "ma_cutover_stage_rows_source_row_locator_check" CHECK ("public"."ma_cutover_locator_is_sanitized"("source_row_locator")),
    CONSTRAINT "ma_cutover_stage_rows_temporary_entity_id_check" CHECK (("temporary_entity_id" ~ '^[A-Za-z0-9][-A-Za-z0-9._:/@+]{0,159}$'::"text"))
);


--
-- Name: ma_firms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_firms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_source_id" "uuid",
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'prospect'::"text" NOT NULL,
    "category" "text",
    "network_label" "text",
    "website_url" "text",
    "internal_notes" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_by" "text",
    "archived_at" timestamp with time zone,
    CONSTRAINT "ma_firms_check" CHECK ((("status" <> 'archived'::"text") OR ("archived_at" IS NOT NULL))),
    CONSTRAINT "ma_firms_name_check" CHECK ((NULLIF("btrim"("name"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_firms_status_check" CHECK (("status" = ANY (ARRAY['prospect'::"text", 'active'::"text", 'archived'::"text"])))
);


--
-- Name: ma_interaction_delivery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_interaction_delivery_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interaction_id" "uuid" NOT NULL,
    "event_kind" "text" NOT NULL,
    "actor" "text" NOT NULL,
    "provider_idempotency_key" "text" NOT NULL,
    "provider_message_id" "text",
    "delivery_error" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_interaction_delivery_events_actor_check" CHECK ((NULLIF("btrim"("actor"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_interaction_delivery_events_check" CHECK ((("event_kind" <> 'failed'::"text") OR (NULLIF("btrim"("delivery_error"), ''::"text") IS NOT NULL))),
    CONSTRAINT "ma_interaction_delivery_events_check1" CHECK ((("event_kind" <> 'sent'::"text") OR (NULLIF("btrim"("provider_message_id"), ''::"text") IS NOT NULL))),
    CONSTRAINT "ma_interaction_delivery_events_event_kind_check" CHECK (("event_kind" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "ma_interaction_delivery_events_provider_idempotency_key_check" CHECK ((NULLIF("btrim"("provider_idempotency_key"), ''::"text") IS NOT NULL))
);


--
-- Name: ma_interaction_legacy_migration_manifest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_interaction_legacy_migration_manifest" (
    "legacy_interaction_id" "uuid" NOT NULL,
    "legacy_evidence_digest" "text" NOT NULL,
    "canonical_evidence_digest" "text" NOT NULL,
    "migrated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_interaction_legacy_migration_canonical_evidence_digest_check" CHECK (("canonical_evidence_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_interaction_legacy_migration_ma_legacy_evidence_digest_check" CHECK (("legacy_evidence_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_interaction_legacy_migration_manifest_check" CHECK (("legacy_evidence_digest" = "canonical_evidence_digest"))
);


--
-- Name: ma_interaction_owner_verification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_interaction_owner_verification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interaction_id" "uuid" NOT NULL,
    "owner_staff_user_id" "text" NOT NULL,
    "verified_by" "text" NOT NULL,
    "verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "previous_state" "text" NOT NULL,
    "resulting_state" "text" NOT NULL,
    CONSTRAINT "ma_interaction_owner_verification_eve_owner_staff_user_id_check" CHECK ((NULLIF("btrim"("owner_staff_user_id"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_interaction_owner_verification_events_previous_state_check" CHECK (("previous_state" = 'provisional'::"text")),
    CONSTRAINT "ma_interaction_owner_verification_events_resulting_state_check" CHECK (("resulting_state" = 'verified'::"text")),
    CONSTRAINT "ma_interaction_owner_verification_events_verified_by_check" CHECK ((NULLIF("btrim"("verified_by"), ''::"text") IS NOT NULL))
);


--
-- Name: ma_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "office_id" "uuid" NOT NULL,
    "affiliation_id" "uuid",
    "opportunity_id" "uuid",
    "channel" "text" NOT NULL,
    "direction" "text",
    "occurred_at" timestamp with time zone NOT NULL,
    "owner_staff_user_id" "text" NOT NULL,
    "owner_verification_state" "text" DEFAULT 'provisional'::"text" NOT NULL,
    "owner_verified_by" "text",
    "owner_verified_at" timestamp with time zone,
    "title" "text",
    "summary" "text",
    "outcome" "text",
    "next_action" "text",
    "next_action_due_at" timestamp with time zone,
    "template_key" "text",
    "recipient_email_snapshot" "text",
    "body_markdown" "text",
    "delivery_status" "text",
    "delivery_error" "text",
    "client_operation_key" "uuid",
    "provider_idempotency_key" "text",
    "provider_request_fingerprint" "text",
    "provider_message_id" "text",
    "delivery_finalized_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_interaction_email_delivery_if_present_check" CHECK ((("channel" <> 'email'::"text") OR ("delivery_status" IS NULL) OR ("delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))),
    CONSTRAINT "ma_interaction_email_provider_evidence_check" CHECK ((("delivery_status" IS NULL) OR (("channel" = 'email'::"text") AND (NULLIF("btrim"("provider_idempotency_key"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "ma_interactions_channel_check" CHECK (("channel" = ANY (ARRAY['call'::"text", 'email'::"text", 'meeting'::"text", 'document'::"text", 'other'::"text"]))),
    CONSTRAINT "ma_interactions_check" CHECK (((("channel" = ANY (ARRAY['call'::"text", 'email'::"text"])) AND ("direction" IS NOT NULL)) OR ("channel" <> ALL (ARRAY['call'::"text", 'email'::"text"])))),
    CONSTRAINT "ma_interactions_check10" CHECK (((NULLIF("btrim"("summary"), ''::"text") IS NOT NULL) OR (NULLIF("btrim"("body_markdown"), ''::"text") IS NOT NULL))),
    CONSTRAINT "ma_interactions_check2" CHECK ((("channel" <> 'email'::"text") OR ("direction" <> 'outbound'::"text") OR (NULLIF("btrim"("recipient_email_snapshot"), ''::"text") IS NOT NULL))),
    CONSTRAINT "ma_interactions_check3" CHECK ((("delivery_status" <> 'failed'::"text") OR (NULLIF("btrim"("delivery_error"), ''::"text") IS NOT NULL))),
    CONSTRAINT "ma_interactions_check4" CHECK ((("delivery_status" <> 'sent'::"text") OR ("sent_at" IS NOT NULL))),
    CONSTRAINT "ma_interactions_check5" CHECK ((("delivery_status" <> 'pending'::"text") OR ("delivery_finalized_at" IS NULL))),
    CONSTRAINT "ma_interactions_check6" CHECK ((("delivery_status" = 'pending'::"text") OR ("delivery_finalized_at" IS NOT NULL))),
    CONSTRAINT "ma_interactions_check7" CHECK ((("delivery_status" <> 'pending'::"text") OR (("client_operation_key" IS NOT NULL) AND ("provider_request_fingerprint" ~ '^[0-9a-f]{64}$'::"text")))),
    CONSTRAINT "ma_interactions_check9" CHECK (((("owner_verification_state" = 'provisional'::"text") AND ("owner_verified_by" IS NULL) AND ("owner_verified_at" IS NULL)) OR (("owner_verification_state" = 'verified'::"text") AND (NULLIF("btrim"("owner_verified_by"), ''::"text") IS NOT NULL) AND ("owner_verified_at" IS NOT NULL)))),
    CONSTRAINT "ma_interactions_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "ma_interactions_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "ma_interactions_owner_verification_state_check" CHECK (("owner_verification_state" = ANY (ARRAY['provisional'::"text", 'verified'::"text"])))
);


--
-- Name: ma_offices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_offices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "firm_id" "uuid" NOT NULL,
    "legacy_source_id" "uuid",
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "city" "text",
    "address" "text",
    "region_codes" "text"[],
    "coverage_note" "text",
    "geography_confidence" "text",
    "website_url" "text",
    "general_email" "text",
    "general_phone" "text",
    "internal_notes" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_by" "text",
    "archived_at" timestamp with time zone,
    CONSTRAINT "ma_offices_check" CHECK ((("status" <> 'archived'::"text") OR ("archived_at" IS NOT NULL))),
    CONSTRAINT "ma_offices_geography_confidence_check" CHECK ((("geography_confidence" IS NULL) OR ("geography_confidence" = ANY (ARRAY['confirmed'::"text", 'review'::"text"])))),
    CONSTRAINT "ma_offices_name_check" CHECK ((NULLIF("btrim"("name"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_offices_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


--
-- Name: ma_opportunity_date_correction_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_opportunity_date_correction_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "opportunity_reference" "text" NOT NULL,
    "prior_date_added" "date" NOT NULL,
    "corrected_date_added" "date" NOT NULL,
    "corrected_precision" "text" NOT NULL,
    "source_evidence_hash" "text" NOT NULL,
    "source_sheet" "text" NOT NULL,
    "source_row" integer NOT NULL,
    "source_reference" "text" NOT NULL,
    "source_date_serial" integer NOT NULL,
    "source_description_hash" "text" NOT NULL,
    "live_description_hash" "text" NOT NULL,
    "correction_code" "text" NOT NULL,
    "corrected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_opportunity_date_correction_ev_source_description_hash_check" CHECK (("source_description_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_opportunity_date_correction_even_live_description_hash_check" CHECK (("live_description_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_opportunity_date_correction_event_source_evidence_hash_check" CHECK (("source_evidence_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_opportunity_date_correction_events_check" CHECK (("prior_date_added" <> "corrected_date_added")),
    CONSTRAINT "ma_opportunity_date_correction_events_corrected_precision_check" CHECK (("corrected_precision" = ANY (ARRAY['day'::"text", 'month'::"text"]))),
    CONSTRAINT "ma_opportunity_date_correction_events_correction_code_check" CHECK (("correction_code" = 'W-098 legacy month-year repair'::"text")),
    CONSTRAINT "ma_opportunity_date_correction_events_source_row_check" CHECK (("source_row" > 0))
);

ALTER TABLE ONLY "public"."ma_opportunity_date_correction_events" FORCE ROW LEVEL SECURITY;


--
-- Name: ma_provisional_source_contexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_provisional_source_contexts" (
    "context_key" "text" NOT NULL,
    "firm_id" "uuid" NOT NULL,
    "office_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "affiliation_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_provisional_source_contexts_context_key_check" CHECK (("context_key" = 'acme_co_paris'::"text"))
);


--
-- Name: ma_provisional_source_review_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_provisional_source_review_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "provisional_office_id" "uuid" NOT NULL,
    "event_kind" "text" NOT NULL,
    "related_assignment_id" "uuid",
    "prior_source_office_id" "uuid",
    "resulting_source_office_id" "uuid" NOT NULL,
    "prior_source_snapshot" "jsonb" NOT NULL,
    "prior_contact_snapshot" "jsonb" NOT NULL,
    "resulting_source_snapshot" "jsonb" NOT NULL,
    "resulting_contact_snapshot" "jsonb" NOT NULL,
    "actor" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_provisional_source_review_e_resulting_contact_snapshot_check" CHECK (("jsonb_typeof"("resulting_contact_snapshot") = 'array'::"text")),
    CONSTRAINT "ma_provisional_source_review_ev_resulting_source_snapshot_check" CHECK (("jsonb_typeof"("resulting_source_snapshot") = 'object'::"text")),
    CONSTRAINT "ma_provisional_source_review_event_prior_contact_snapshot_check" CHECK (("jsonb_typeof"("prior_contact_snapshot") = 'array'::"text")),
    CONSTRAINT "ma_provisional_source_review_events_actor_check" CHECK ((NULLIF("btrim"("actor"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_provisional_source_review_events_check" CHECK (((("event_kind" = 'assigned'::"text") AND ("related_assignment_id" IS NULL)) OR (("event_kind" = 'resolved'::"text") AND ("related_assignment_id" IS NOT NULL)))),
    CONSTRAINT "ma_provisional_source_review_events_event_kind_check" CHECK (("event_kind" = ANY (ARRAY['assigned'::"text", 'resolved'::"text"]))),
    CONSTRAINT "ma_provisional_source_review_events_prior_source_snapshot_check" CHECK (("jsonb_typeof"("prior_source_snapshot") = 'object'::"text")),
    CONSTRAINT "ma_provisional_source_review_events_reason_check" CHECK ((NULLIF("btrim"("reason"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_provisional_source_review_events_reason_check1" CHECK (("char_length"("reason") <= 4096))
);


--
-- Name: ma_source_contact_moves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_source_contact_moves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "old_source_id" "uuid" NOT NULL,
    "new_source_id" "uuid" NOT NULL,
    "old_name" "text",
    "new_name" "text",
    "old_email" "text",
    "new_email" "text",
    "old_phone" "text",
    "new_phone" "text",
    "moved_by" "text" NOT NULL,
    "moved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: ma_source_email_send_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_source_email_send_reservations" (
    "opportunity_id" "uuid" NOT NULL,
    "reservation_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_office_id" "uuid",
    "actor" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "ma_source_email_send_reservations_actor_check" CHECK ((NULLIF("btrim"("actor"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_source_email_send_reservations_check" CHECK (("expires_at" > "created_at"))
);


--
-- Name: ma_source_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_source_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "source_id" "uuid",
    "template_key" "text" NOT NULL,
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_markdown" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_id" "uuid"
);


--
-- Name: ma_source_networks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_source_networks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "internal_notes" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_source_networks_name_check" CHECK ((NULLIF("btrim"("name"), ''::"text") IS NOT NULL))
);


--
-- Name: ma_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "firm_name" "text" NOT NULL,
    "source_type" "public"."ma_source_type" DEFAULT 'ma_firm'::"public"."ma_source_type" NOT NULL,
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "notes" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "internal_notes" "text",
    "network_id" "uuid",
    "firm_id" "uuid",
    "default_office_id" "uuid"
);


--
-- Name: ma_w039_geography_adoption_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_w039_geography_adoption_evidence" (
    "run_id" "uuid" NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "source_geography_code" "text",
    "target_stable_key" "text",
    "geography_node_before" "uuid",
    "geography_node_after" "uuid",
    "location_digest" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    CONSTRAINT "ma_w039_geography_adoption_evidence_location_digest_check" CHECK (("location_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_w039_geography_adoption_evidence_outcome_check" CHECK (("outcome" = ANY (ARRAY['applied'::"text", 'already_canonical'::"text", 'preserved_wave_edit'::"text", 'review_outside_france'::"text"])))
);

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_evidence" FORCE ROW LEVEL SECURITY;


--
-- Name: ma_w039_geography_adoption_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_w039_geography_adoption_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_hash" "text" NOT NULL,
    "payload_digest" "text" NOT NULL,
    "applied_by" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ma_w039_geography_adoption_runs_applied_by_check" CHECK ((NULLIF("btrim"("applied_by"), ''::"text") IS NOT NULL)),
    CONSTRAINT "ma_w039_geography_adoption_runs_payload_digest_check" CHECK (("payload_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "ma_w039_geography_adoption_runs_source_hash_check" CHECK (("source_hash" ~ '^[0-9a-f]{64}$'::"text"))
);

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_runs" FORCE ROW LEVEL SECURITY;


--
-- Name: ma_w039_release_control; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ma_w039_release_control" (
    "singleton" boolean DEFAULT true NOT NULL,
    "enforce_new_opportunity_geography" boolean DEFAULT false NOT NULL,
    "activated_by" "text",
    "activated_at" timestamp with time zone,
    CONSTRAINT "ma_w039_release_control_singleton_check" CHECK ("singleton")
);

ALTER TABLE ONLY "public"."ma_w039_release_control" FORCE ROW LEVEL SECURITY;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text" NOT NULL,
    "note_type" "text" DEFAULT 'other'::"text" NOT NULL
);


--
-- Name: notification_delivery_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_delivery_claims" (
    "idempotency_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "lease_expires_at" timestamp with time zone,
    "lease_token" "uuid",
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "provider_message_id" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_delivery_claims_attempt_count_check" CHECK (("attempt_count" > 0)),
    CONSTRAINT "notification_delivery_claims_idempotency_key_check" CHECK ((NULLIF("btrim"("idempotency_key"), ''::"text") IS NOT NULL)),
    CONSTRAINT "notification_delivery_claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


--
-- Name: offer_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."offer_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_offer_id" "uuid" NOT NULL,
    "milestone_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text" NOT NULL,
    CONSTRAINT "offer_milestones_milestone_type_check" CHECK (("milestone_type" = ANY (ARRAY['deliverable'::"text", 'checkpoint'::"text"])))
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "duration_days" integer NOT NULL,
    "acceptance_deadline_days" integer NOT NULL,
    "includes_hours" numeric(10,2) NOT NULL,
    "includes_resources" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: opportunity_closure_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_closure_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "reason" "public"."opportunity_closure_reason" NOT NULL,
    "closed_by" "text" NOT NULL,
    "closed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: opportunity_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "document_type" "public"."opportunity_document_type" DEFAULT 'other'::"public"."opportunity_document_type" NOT NULL,
    "visibility" "public"."opportunity_document_visibility" DEFAULT 'staff_only'::"public"."opportunity_document_visibility" NOT NULL,
    "storage_bucket" "text" DEFAULT 'opportunity-documents'::"text" NOT NULL,
    "storage_path" "text",
    "external_url" "text",
    "file_name" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "repreneur_approved_at" timestamp with time zone,
    "repreneur_approved_by" "text",
    CONSTRAINT "opportunity_documents_check" CHECK ((("storage_path" IS NOT NULL) OR ("external_url" IS NOT NULL)))
);


--
-- Name: opportunity_ma_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_ma_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "affiliation_id" "uuid" NOT NULL,
    "legacy_source_contact_id" "uuid",
    "contact_name_snapshot" "text",
    "contact_email_snapshot" "text",
    "contact_phone_snapshot" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "linked_by" "text",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_by" "text",
    "removed_at" timestamp with time zone,
    CONSTRAINT "opportunity_ma_contacts_check" CHECK ((("is_active" AND ("removed_at" IS NULL)) OR ((NOT "is_active") AND ("removed_at" IS NOT NULL))))
);


--
-- Name: opportunity_mandate_reference_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_mandate_reference_counters" (
    "reference_code" "text" NOT NULL,
    "next_sequence" bigint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "opportunity_mandate_reference_counters_next_sequence_check" CHECK (("next_sequence" >= 1)),
    CONSTRAINT "opportunity_mandate_reference_counters_reference_code_check" CHECK (("reference_code" ~ '^[A-Z0-9]+$'::"text"))
);

ALTER TABLE ONLY "public"."opportunity_mandate_reference_counters" FORCE ROW LEVEL SECURITY;


--
-- Name: opportunity_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "status" "public"."opportunity_match_status" DEFAULT 'draft'::"public"."opportunity_match_status" NOT NULL,
    "platform_recommendation" "public"."opportunity_match_recommendation" DEFAULT 'not_evaluated'::"public"."opportunity_match_recommendation" NOT NULL,
    "platform_score" integer,
    "platform_reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "human_recommendation" "public"."opportunity_match_recommendation" DEFAULT 'not_evaluated'::"public"."opportunity_match_recommendation" NOT NULL,
    "human_notes" "text",
    "created_by" "text",
    "reviewed_by" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pursuit_stage" "public"."opportunity_pursuit_stage",
    "pursuit_stage_notes" "text",
    "pursuit_stage_updated_by" "text",
    "pursuit_stage_updated_at" timestamp with time zone,
    "nda_status" "public"."opportunity_nda_status" DEFAULT 'not_required'::"public"."opportunity_nda_status" NOT NULL,
    "nda_document_id" "uuid",
    "nda_notes" "text",
    "nda_updated_by" "text",
    "nda_updated_at" timestamp with time zone,
    "decline_reason_categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "decline_reason_text" "text",
    "interest_expressed_at" timestamp with time zone,
    "interest_notification_sent_at" timestamp with time zone,
    "nda_received_at" timestamp with time zone,
    "nda_signed_at" timestamp with time zone,
    "nda_waived_at" timestamp with time zone,
    "nda_waived_by" "text",
    CONSTRAINT "opportunity_matches_platform_score_check" CHECK ((("platform_score" IS NULL) OR (("platform_score" >= 0) AND ("platform_score" <= 100))))
);


--
-- Name: opportunity_memo_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_memo_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "last_error" "text",
    "provider_id" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "opportunity_memo_notifications_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "opportunity_memo_notifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'failed'::"text", 'sent'::"text"])))
);


--
-- Name: opportunity_nda_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_nda_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "match_id" "uuid",
    "document_id" "uuid" NOT NULL,
    "artifact_role" "public"."opportunity_nda_artifact_role" NOT NULL,
    "version_number" integer NOT NULL,
    "content_sha256" "text" NOT NULL,
    "supersedes_artifact_id" "uuid",
    "recorded_by" "text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "opportunity_nda_artifacts_content_sha256_check" CHECK (("content_sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "opportunity_nda_artifacts_recorded_by_check" CHECK (("btrim"("recorded_by") <> ''::"text")),
    CONSTRAINT "opportunity_nda_artifacts_scope_check" CHECK (((("artifact_role" = 'blank_template'::"public"."opportunity_nda_artifact_role") AND ("match_id" IS NULL)) OR (("artifact_role" = ANY (ARRAY['renew_signed_copy'::"public"."opportunity_nda_artifact_role", 'repreneur_signed_copy'::"public"."opportunity_nda_artifact_role"])) AND ("match_id" IS NOT NULL)))),
    CONSTRAINT "opportunity_nda_artifacts_version_chain_check" CHECK (((("version_number" = 1) AND ("supersedes_artifact_id" IS NULL)) OR (("version_number" > 1) AND ("supersedes_artifact_id" IS NOT NULL)))),
    CONSTRAINT "opportunity_nda_artifacts_version_number_check" CHECK (("version_number" > 0))
);

ALTER TABLE ONLY "public"."opportunity_nda_artifacts" FORCE ROW LEVEL SECURITY;


--
-- Name: opportunity_pursuit_confidential_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_pursuit_confidential_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "information_memo_document_id" "uuid" NOT NULL,
    "source_firm_id" "uuid" NOT NULL,
    "source_firm_name" "text" NOT NULL,
    "source_office_id" "uuid" NOT NULL,
    "source_office_name" "text" NOT NULL,
    "disclosed_contacts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_disclosed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "text" NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "text",
    "revoked_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cycle_started_evidence_id" "uuid",
    "gate_2_evidence_id" "uuid",
    "dispatch_evidence_id" "uuid",
    "nda_expires_at" timestamp with time zone,
    CONSTRAINT "opportunity_pursuit_confidential_grant_disclosed_contacts_check" CHECK (("jsonb_typeof"("disclosed_contacts") = 'array'::"text")),
    CONSTRAINT "opportunity_pursuit_confidential_grants_check" CHECK (((("revoked_at" IS NULL) AND ("revoked_by" IS NULL) AND ("revoked_reason" IS NULL)) OR (("revoked_at" IS NOT NULL) AND (NULLIF("btrim"("revoked_by"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "opportunity_pursuit_confidential_grants_granted_by_check" CHECK ((NULLIF("btrim"("granted_by"), ''::"text") IS NOT NULL))
);

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants" FORCE ROW LEVEL SECURITY;


--
-- Name: opportunity_pursuit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_pursuit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "stage" "public"."opportunity_pursuit_stage" NOT NULL,
    "note" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: opportunity_pursuit_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_pursuit_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "event_type" "public"."opportunity_pursuit_evidence_type" NOT NULL,
    "actor" "text" NOT NULL,
    "evidence_reference" "text",
    "nda_artifact_id" "uuid",
    "document_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "opportunity_pursuit_evidence_actor_check" CHECK ((NULLIF("btrim"("actor"), ''::"text") IS NOT NULL)),
    CONSTRAINT "opportunity_pursuit_evidence_idempotency_key_check" CHECK ((NULLIF("btrim"("idempotency_key"), ''::"text") IS NOT NULL)),
    CONSTRAINT "opportunity_pursuit_evidence_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text"))
);

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence" FORCE ROW LEVEL SECURITY;


--
-- Name: opportunity_source_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."opportunity_source_contacts" (
    "opportunity_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_name_snapshot" "text",
    "contact_email_snapshot" "text",
    "contact_phone_snapshot" "text",
    "canonical_opportunity_contact_id" "uuid"
);


--
-- Name: pdr_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pdr_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_card_id" "uuid" NOT NULL,
    "actor" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "body" "text" NOT NULL,
    "requested_from" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pdr_feedback_actor_check" CHECK (("actor" = ANY (ARRAY['Dev team'::"text", 'qa_person'::"text", 'Colin'::"text", 'System'::"text"]))),
    CONSTRAINT "pdr_feedback_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 4000))),
    CONSTRAINT "pdr_feedback_kind_check" CHECK (("kind" = ANY (ARRAY['request_input'::"text", 'feedback'::"text", 'system'::"text"]))),
    CONSTRAINT "pdr_feedback_requested_from_check" CHECK (("jsonb_typeof"("requested_from") = 'array'::"text"))
);


--
-- Name: pdr_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pdr_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "kpi_label" "text" NOT NULL,
    "kpi_current" numeric DEFAULT 0 NOT NULL,
    "kpi_target" numeric NOT NULL,
    "kpi_unit" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kpi_baseline" numeric DEFAULT 0 NOT NULL,
    "kpi_target_date" "date" DEFAULT '2026-09-30'::"date",
    CONSTRAINT "pdr_goals_kpi_target_check" CHECK ((("kpi_target" > (0)::numeric) OR (("kpi_baseline" = (0)::numeric) AND ("kpi_current" = (0)::numeric) AND ("kpi_target" = (0)::numeric) AND ("kpi_target_date" IS NULL))))
);


--
-- Name: pdr_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pdr_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "due_date" "date",
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivery_status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "delivery_health" "text" DEFAULT 'on_track'::"text" NOT NULL,
    "stopped_reason" "text" DEFAULT ''::"text" NOT NULL,
    "goal_id" "uuid",
    "timing_label" "text" DEFAULT ''::"text" NOT NULL,
    "window_start" "date",
    "window_end" "date",
    "is_orphan" boolean DEFAULT false NOT NULL,
    CONSTRAINT "pdr_milestones_delivery_health_check" CHECK (("delivery_health" = ANY (ARRAY['unknown'::"text", 'on_track'::"text", 'at_risk'::"text", 'late'::"text"]))),
    CONSTRAINT "pdr_milestones_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'delivered'::"text", 'stopped'::"text"])))
);


--
-- Name: pdr_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pdr_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_text" "text" NOT NULL,
    "conversation" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "question_count" integer DEFAULT 0 NOT NULL,
    "proposal_type" "text" DEFAULT 'product_problem'::"text" NOT NULL,
    "problem_statement" "text" DEFAULT ''::"text" NOT NULL,
    "affected_user" "text" DEFAULT ''::"text" NOT NULL,
    "current_behavior" "text" DEFAULT ''::"text" NOT NULL,
    "impact" "text" DEFAULT ''::"text" NOT NULL,
    "desired_outcome" "text" DEFAULT ''::"text" NOT NULL,
    "success_signal" "text" DEFAULT ''::"text" NOT NULL,
    "constraints" "text" DEFAULT ''::"text" NOT NULL,
    "suggested_goal_id" "uuid",
    "suggested_milestone_id" "uuid",
    "ai_rationale" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "reviewer_note" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "text" DEFAULT 'Team'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform_connection" "text" DEFAULT ''::"text" NOT NULL,
    "technical_impact" "text" DEFAULT ''::"text" NOT NULL,
    "complexity" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "complexity_rationale" "text" DEFAULT ''::"text" NOT NULL,
    "complexity_confidence" "text" DEFAULT 'low'::"text" NOT NULL,
    "affected_code_areas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "context_snapshot" "text" DEFAULT ''::"text" NOT NULL,
    "requester_actor" "text" DEFAULT 'Dev team'::"text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "material_summary" "text" DEFAULT ''::"text" NOT NULL,
    "strategic_placement" "text" DEFAULT 'existing_bundle'::"text" NOT NULL,
    "suggested_bundle_id" "uuid",
    "suggested_bundle_title" "text" DEFAULT ''::"text" NOT NULL,
    "card_intent" "text" DEFAULT 'new_work'::"text" NOT NULL,
    "matched_work_card_id" "uuid",
    "match_rationale" "text" DEFAULT ''::"text" NOT NULL,
    "email_state" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_error" "text" DEFAULT ''::"text" NOT NULL,
    "email_sent_at" timestamp with time zone,
    "conversion_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversion_ref" "uuid",
    "matched_proposal_id" "uuid",
    CONSTRAINT "pdr_proposals_affected_code_areas_array" CHECK (("jsonb_typeof"("affected_code_areas") = 'array'::"text")),
    CONSTRAINT "pdr_proposals_affected_code_areas_check" CHECK (("jsonb_typeof"("affected_code_areas") = 'array'::"text")),
    CONSTRAINT "pdr_proposals_affected_user_check" CHECK (("char_length"("affected_user") <= 1000)),
    CONSTRAINT "pdr_proposals_ai_rationale_check" CHECK (("char_length"("ai_rationale") <= 1000)),
    CONSTRAINT "pdr_proposals_attachments_check" CHECK (("jsonb_typeof"("attachments") = 'array'::"text")),
    CONSTRAINT "pdr_proposals_card_intent_check" CHECK (("card_intent" = ANY (ARRAY['new_work'::"text", 'replace_existing'::"text"]))),
    CONSTRAINT "pdr_proposals_complexity_check" CHECK (("complexity" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text", 'unknown'::"text"]))),
    CONSTRAINT "pdr_proposals_complexity_confidence_check" CHECK (("complexity_confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "pdr_proposals_complexity_rationale_length" CHECK (("char_length"("complexity_rationale") <= 1500)),
    CONSTRAINT "pdr_proposals_constraints_check" CHECK (("char_length"("constraints") <= 1500)),
    CONSTRAINT "pdr_proposals_context_snapshot_length" CHECK (("char_length"("context_snapshot") <= 120)),
    CONSTRAINT "pdr_proposals_conversation_check" CHECK (("jsonb_typeof"("conversation") = 'array'::"text")),
    CONSTRAINT "pdr_proposals_created_by_check" CHECK ((("char_length"("created_by") >= 1) AND ("char_length"("created_by") <= 80))),
    CONSTRAINT "pdr_proposals_current_behavior_check" CHECK (("char_length"("current_behavior") <= 1500)),
    CONSTRAINT "pdr_proposals_desired_outcome_check" CHECK (("char_length"("desired_outcome") <= 1500)),
    CONSTRAINT "pdr_proposals_email_state_check" CHECK (("email_state" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "pdr_proposals_impact_check" CHECK (("char_length"("impact") <= 1500)),
    CONSTRAINT "pdr_proposals_original_text_check" CHECK ((("char_length"("original_text") >= 10) AND ("char_length"("original_text") <= 4000))),
    CONSTRAINT "pdr_proposals_platform_connection_length" CHECK (("char_length"("platform_connection") <= 1500)),
    CONSTRAINT "pdr_proposals_problem_statement_check" CHECK (("char_length"("problem_statement") <= 1000)),
    CONSTRAINT "pdr_proposals_proposal_type_check" CHECK (("proposal_type" = ANY (ARRAY['bug'::"text", 'small_improvement'::"text", 'product_problem'::"text"]))),
    CONSTRAINT "pdr_proposals_question_count_check" CHECK ((("question_count" >= 0) AND ("question_count" <= 5))),
    CONSTRAINT "pdr_proposals_requester_actor_check" CHECK (("requester_actor" = ANY (ARRAY['Dev team'::"text", 'qa_person'::"text", 'Colin'::"text"]))),
    CONSTRAINT "pdr_proposals_reviewer_note_check" CHECK (("char_length"("reviewer_note") <= 2000)),
    CONSTRAINT "pdr_proposals_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'conversing'::"text", 'ready_for_review'::"text", 'needs_answer'::"text", 'approved_problem'::"text", 'converted'::"text", 'parked'::"text", 'rejected'::"text", 'archived'::"text"]))),
    CONSTRAINT "pdr_proposals_strategic_placement_check" CHECK (("strategic_placement" = ANY (ARRAY['existing_bundle'::"text", 'new_bundle'::"text", 'orphan'::"text"]))),
    CONSTRAINT "pdr_proposals_success_signal_check" CHECK (("char_length"("success_signal") <= 1000)),
    CONSTRAINT "pdr_proposals_technical_impact_length" CHECK (("char_length"("technical_impact") <= 1500))
);


--
-- Name: pdr_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pdr_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "goal_id" "uuid",
    "milestone_id" "uuid",
    "evidence_text" "text" DEFAULT ''::"text" NOT NULL,
    "metric_text" "text" DEFAULT ''::"text" NOT NULL,
    "smallest_version" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'needs_detail'::"text" NOT NULL,
    "challenge_score" integer DEFAULT 0 NOT NULL,
    "challenge_prompts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "text" DEFAULT 'Team'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decision_note" "text" DEFAULT ''::"text" NOT NULL,
    "priority" "text" DEFAULT 'unassigned'::"text" NOT NULL,
    CONSTRAINT "pdr_requests_challenge_prompts_check" CHECK (("jsonb_typeof"("challenge_prompts") = 'array'::"text")),
    CONSTRAINT "pdr_requests_challenge_score_check" CHECK ((("challenge_score" >= 0) AND ("challenge_score" <= 4))),
    CONSTRAINT "pdr_requests_created_by_check" CHECK ((("char_length"("created_by") >= 1) AND ("char_length"("created_by") <= 80))),
    CONSTRAINT "pdr_requests_description_check" CHECK ((("char_length"("description") >= 10) AND ("char_length"("description") <= 4000))),
    CONSTRAINT "pdr_requests_priority_check" CHECK (("priority" = ANY (ARRAY['now'::"text", 'next'::"text", 'later'::"text", 'unassigned'::"text"]))),
    CONSTRAINT "pdr_requests_status_check" CHECK (("status" = ANY (ARRAY['new_request'::"text", 'needs_clarification'::"text", 'ready_for_decision'::"text", 'accepted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "pdr_requests_title_check" CHECK ((("char_length"("title") >= 3) AND ("char_length"("title") <= 140)))
);


--
-- Name: pdr_work_card_reference_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."pdr_work_card_reference_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdr_work_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pdr_work_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "strategic_item_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "owner" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "blocked" boolean DEFAULT false NOT NULL,
    "blocked_reason" "text" DEFAULT ''::"text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assignees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_proposal_id" "uuid",
    "clarification_state" "text" DEFAULT 'none'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "archived_reason" "text" DEFAULT ''::"text" NOT NULL,
    "replaces_card_id" "uuid",
    "replaced_by_card_id" "uuid",
    "reference_number" bigint DEFAULT "nextval"('"public"."pdr_work_card_reference_seq"'::"regclass") NOT NULL,
    "legacy_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "pdr_work_cards_assignees_check" CHECK (("jsonb_typeof"("assignees") = 'array'::"text")),
    CONSTRAINT "pdr_work_cards_attachments_check" CHECK (("jsonb_typeof"("attachments") = 'array'::"text")),
    CONSTRAINT "pdr_work_cards_clarification_state_check" CHECK (("clarification_state" = ANY (ARRAY['none'::"text", 'needs_input'::"text", 'feedback_added'::"text"]))),
    CONSTRAINT "pdr_work_cards_owner_check" CHECK ((("char_length"("owner") >= 1) AND ("char_length"("owner") <= 80))),
    CONSTRAINT "pdr_work_cards_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in_progress'::"text", 'review'::"text", 'done'::"text"]))),
    CONSTRAINT "pdr_work_cards_title_check" CHECK ((("char_length"("title") >= 3) AND ("char_length"("title") <= 180)))
);


--
-- Name: rateLimit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rateLimit" (
    "key" "text" NOT NULL,
    "count" integer NOT NULL,
    "lastRequest" bigint NOT NULL,
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL
);


--
-- Name: repreneur_geography_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."repreneur_geography_targets" (
    "repreneur_id" "uuid" NOT NULL,
    "geography_node_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."repreneur_geography_targets" FORCE ROW LEVEL SECURITY;


--
-- Name: repreneur_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."repreneur_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repreneur_id" "uuid" NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "status" "public"."repreneur_offer_status" DEFAULT 'offered'::"public"."repreneur_offer_status" NOT NULL,
    "offered_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "declined_at" timestamp with time zone
);


--
-- Name: repreneurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."repreneurs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "company_background" "text",
    "investment_capacity" "text",
    "sector_preferences" "text"[],
    "target_acquisition_size" "text",
    "lifecycle_status" "public"."lifecycle_status" DEFAULT 'lead'::"public"."lifecycle_status" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    "journey_stage" "text" DEFAULT 'explorer'::"text",
    "tier1_score" integer,
    "tier2_stars" integer,
    "rejected_at" timestamp with time zone,
    "previous_status" "text",
    "q1_employment_status" "text",
    "q2_years_experience" "text",
    "q3_industry_sectors" "jsonb" DEFAULT '[]'::"jsonb",
    "q4_has_ma_experience" boolean,
    "q5_team_size" "text",
    "q6_involved_in_ma" boolean,
    "q7_ma_details" "text",
    "q8_executive_roles" "jsonb" DEFAULT '[]'::"jsonb",
    "q9_board_experience" boolean,
    "q10_journey_stages" "jsonb" DEFAULT '[]'::"jsonb",
    "q11_target_sectors" "jsonb" DEFAULT '[]'::"jsonb",
    "q12_has_identified_targets" boolean,
    "q13_target_details" "text",
    "q14_investment_capacity" "text",
    "q15_funding_status" "text",
    "q16_network_training" "jsonb" DEFAULT '[]'::"jsonb",
    "q17_open_to_co_acquisition" boolean,
    "tier1_score_breakdown" "jsonb",
    "questionnaire_completed_at" timestamp with time zone,
    "linkedin_url" "text",
    "marketing_consent" boolean DEFAULT false,
    "consent_timestamp" timestamp with time zone,
    "consent_source" "text",
    "cv_url" "text",
    "ldc_url" "text",
    "flatchr_id" "text",
    "avatar_url" "text",
    "tier2_leadership" integer,
    "tier2_financial_acumen" integer,
    "tier2_communication" integer,
    "tier2_clarity_of_vision" integer,
    "tier2_coachability" integer,
    "tier2_commitment" integer,
    "tier2_overall" numeric(3,2),
    "tier2_rated_at" timestamp with time zone,
    "tier2_rated_by" "uuid",
    "ms_investment_thesis" boolean DEFAULT false,
    "ms_target_profile" boolean DEFAULT false,
    "ms_first_intermediary" boolean DEFAULT false,
    "ms_starter_pack" boolean DEFAULT false,
    "ms_ldc_validated" boolean DEFAULT false,
    "ms_financing_proof" boolean DEFAULT false,
    "ms_advisory_team" boolean DEFAULT false,
    "ms_search_plan" boolean DEFAULT false,
    "ms_first_target" boolean DEFAULT false,
    "ms_dd_checklist" boolean DEFAULT false,
    "tier3_milestone_count" integer DEFAULT 0,
    "persona" "text",
    "ms_first_acquisition" boolean DEFAULT false,
    "target_location" "jsonb",
    "q05_status" "text",
    "q06_experience" "text",
    "q07_leadership" "text",
    "q08_crisis" "text",
    "q09_investment" "text",
    "q10_impact" "text",
    "q11_project_status" "jsonb" DEFAULT '[]'::"jsonb",
    "q12_geo_zones" "jsonb" DEFAULT '[]'::"jsonb",
    "q13_target_sectors_v2" "jsonb" DEFAULT '[]'::"jsonb",
    "q14_deal_size" "jsonb" DEFAULT '[]'::"jsonb",
    "q15_structure" "jsonb" DEFAULT '[]'::"jsonb",
    "q16_equity" "text",
    "who_score" integer,
    "when_score" integer,
    "who_score_breakdown" "jsonb",
    "when_score_breakdown" "jsonb",
    "scoring_flags" "jsonb" DEFAULT '[]'::"jsonb",
    "recommendation" "text",
    "needs_data_completion" boolean DEFAULT false,
    "declined_at" timestamp with time zone,
    "ms_decision_to_pursue" boolean DEFAULT false,
    "ms_availability_confirmed" boolean DEFAULT false,
    "ms_target_profile_sheet" boolean DEFAULT false,
    "ms_pitch_plan" boolean DEFAULT false,
    "ms_equity_range" boolean DEFAULT false,
    "ms_deal_breakers" boolean DEFAULT false,
    "ms_advisory_team_structured" boolean DEFAULT false,
    "ms_leadership_assessment_passed" boolean DEFAULT false,
    "ms_advisory_team_identified" boolean DEFAULT false,
    "ms_intermediary_meeting" boolean DEFAULT false,
    "ms_seller_meeting" boolean DEFAULT false,
    "ms_loi_issued" boolean DEFAULT false,
    "ms_due_diligence" boolean DEFAULT false,
    "ms_negotiation" boolean DEFAULT false,
    "ms_financing_validated" boolean DEFAULT false,
    "ms_closing" boolean DEFAULT false,
    "ms_plan_100_days" boolean DEFAULT false,
    "ms_plan_3_years" boolean DEFAULT false,
    "leadership_assessment_id" "uuid",
    "first_contact_date" timestamp with time zone,
    "first_meeting_date" timestamp with time zone,
    "qualification_date" timestamp with time zone,
    "scoring_accuracy_notes" "text",
    "decline_reason_category" character varying(50),
    "decline_reason_text" "text",
    "who_accuracy" character varying(20),
    "when_accuracy" character varying(20),
    "accuracy_notes" "text",
    "accuracy_rated_at" timestamp with time zone,
    "accuracy_rated_by" "text",
    "q11_priority_choice" "text",
    "q17_current_needs" "jsonb" DEFAULT '[]'::"jsonb",
    "target_revenue_min_meur" numeric(12,2),
    "target_revenue_max_meur" numeric(12,2),
    "target_ebitda_margin_min_pct" numeric(5,2),
    "target_ebitda_margin_max_pct" numeric(5,2),
    "target_staff_size_min" integer,
    "target_staff_size_max" integer,
    "ldc_self_certified_at" timestamp with time zone,
    "advisory_team_self_certified_at" timestamp with time zone,
    CONSTRAINT "repreneurs_journey_stage_check" CHECK ((("journey_stage" IS NULL) OR ("journey_stage" = ANY (ARRAY['explorer'::"text", 'learner'::"text", 'ready'::"text", 'execution'::"text", 'post_acquisition'::"text", 'serial_acquirer'::"text"])))),
    CONSTRAINT "repreneurs_q11_priority_choice_check" CHECK ((("q11_priority_choice" IS NULL) OR ("q11_priority_choice" = ANY (ARRAY['preferred'::"text", 'one_among_others'::"text"])))),
    CONSTRAINT "repreneurs_tier2_clarity_of_vision_check" CHECK ((("tier2_clarity_of_vision" IS NULL) OR (("tier2_clarity_of_vision" >= 1) AND ("tier2_clarity_of_vision" <= 5)))),
    CONSTRAINT "repreneurs_tier2_coachability_check" CHECK ((("tier2_coachability" IS NULL) OR (("tier2_coachability" >= 1) AND ("tier2_coachability" <= 5)))),
    CONSTRAINT "repreneurs_tier2_commitment_check" CHECK ((("tier2_commitment" IS NULL) OR (("tier2_commitment" >= 1) AND ("tier2_commitment" <= 5)))),
    CONSTRAINT "repreneurs_tier2_communication_check" CHECK ((("tier2_communication" IS NULL) OR (("tier2_communication" >= 1) AND ("tier2_communication" <= 5)))),
    CONSTRAINT "repreneurs_tier2_financial_acumen_check" CHECK ((("tier2_financial_acumen" IS NULL) OR (("tier2_financial_acumen" >= 1) AND ("tier2_financial_acumen" <= 5)))),
    CONSTRAINT "repreneurs_tier2_leadership_check" CHECK ((("tier2_leadership" IS NULL) OR (("tier2_leadership" >= 1) AND ("tier2_leadership" <= 5)))),
    CONSTRAINT "tier2_stars_range" CHECK ((("tier2_stars" IS NULL) OR (("tier2_stars" >= 1) AND ("tier2_stars" <= 5))))
);


--
-- Name: sector_taxonomy_legacy_20260720; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."sector_taxonomy_legacy_20260720" (
    "entity_type" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "field_name" "text" NOT NULL,
    "original_value" "jsonb" NOT NULL,
    "backed_up_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."session" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "token" "text" NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "ipAddress" "text",
    "userAgent" "text",
    "createdAt" timestamp without time zone DEFAULT "now"(),
    "updatedAt" timestamp without time zone DEFAULT "now"()
);


--
-- Name: staff_ma_office_intake_projection; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."staff_ma_office_intake_projection" WITH ("security_invoker"='true') AS
 SELECT "office"."id" AS "office_id",
    "firm"."id" AS "firm_id",
    "firm"."name" AS "firm_name",
    "office"."name" AS "office_name",
        CASE
            WHEN ("btrim"("office"."name") = "btrim"("firm"."name")) THEN "firm"."name"
            ELSE (("firm"."name" || ' — '::"text") || "office"."name")
        END AS "office_label",
    "contact_context"."affiliation_id",
    "contact_context"."contact_id",
    "contact_context"."contact_name",
    "contact_context"."contact_email",
    "contact_context"."job_title",
    "firm"."status" AS "firm_status",
    "office"."is_default" AS "office_is_default"
   FROM (("public"."ma_offices" "office"
     JOIN "public"."ma_firms" "firm" ON (("firm"."id" = "office"."firm_id")))
     LEFT JOIN LATERAL ( SELECT "affiliation"."id" AS "affiliation_id",
            "contact"."id" AS "contact_id",
            "contact"."display_name" AS "contact_name",
            "contact"."email" AS "contact_email",
            "affiliation"."job_title"
           FROM ("public"."ma_contact_office_affiliations" "affiliation"
             JOIN "public"."ma_contacts" "contact" ON (("contact"."id" = "affiliation"."contact_id")))
          WHERE (("affiliation"."office_id" = "office"."id") AND "affiliation"."is_active" AND ("contact"."status" = 'active'::"text"))) "contact_context" ON (true))
  WHERE (("firm"."status" <> 'archived'::"text") AND ("office"."status" = 'active'::"text") AND ((NOT "office"."is_default") OR (NOT (EXISTS ( SELECT 1
           FROM "public"."ma_offices" "real_office"
          WHERE (("real_office"."firm_id" = "office"."firm_id") AND ("real_office"."status" = 'active'::"text") AND (NOT "real_office"."is_default")))))));


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "owner_id" "uuid",
    "owner_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "expected_start_date" "date",
    "expected_end_date" "date",
    "actual_start_date" "date",
    "actual_end_date" "date",
    "depends_on" "uuid"[] DEFAULT '{}'::"uuid"[],
    "stream" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "notes" "text",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'blocked'::"text", 'completed'::"text"]))),
    CONSTRAINT "tasks_stream_check" CHECK (("stream" = ANY (ARRAY['questionnaire'::"text", 'email'::"text", 'domain'::"text", 'implementation'::"text", 'testing'::"text", 'launch'::"text"])))
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user" (
    "id" "text" NOT NULL,
    "name" "text",
    "email" "text" NOT NULL,
    "emailVerified" boolean DEFAULT false,
    "image" "text",
    "createdAt" timestamp without time zone DEFAULT "now"(),
    "updatedAt" timestamp without time zone DEFAULT "now"()
);


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."verification" (
    "id" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "value" "text" NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"(),
    "updatedAt" timestamp without time zone DEFAULT "now"()
);


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "promoted_repreneur_id" "uuid",
    "promoted_at" timestamp with time zone,
    "promoted_by" "text",
    CONSTRAINT "waitlist_role_check" CHECK (("role" = ANY (ARRAY['repreneur'::"text", 'seller'::"text"]))),
    CONSTRAINT "waitlist_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: wave_journey_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."wave_journey_settings" (
    "singleton" boolean DEFAULT true NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    CONSTRAINT "wave_journey_settings_singleton_check" CHECK ("singleton")
);

ALTER TABLE ONLY "public"."wave_journey_settings" FORCE ROW LEVEL SECURITY;


--
-- Name: wavy_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."wavy_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wavy_templates_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text"])))
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."account"
    ADD CONSTRAINT "account_pkey" PRIMARY KEY ("id");


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");


--
-- Name: ai_generation_events ai_generation_events_generation_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_generation_events"
    ADD CONSTRAINT "ai_generation_events_generation_id_event_type_key" UNIQUE ("generation_id", "event_type");


--
-- Name: ai_generation_events ai_generation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_generation_events"
    ADD CONSTRAINT "ai_generation_events_pkey" PRIMARY KEY ("id");


--
-- Name: ai_generation_runs ai_generation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_generation_runs"
    ADD CONSTRAINT "ai_generation_runs_pkey" PRIMARY KEY ("generation_id");


--
-- Name: ai_generation_runs ai_generation_runs_trace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_generation_runs"
    ADD CONSTRAINT "ai_generation_runs_trace_id_key" UNIQUE ("trace_id");


--
-- Name: app_user_roles app_user_roles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_user_roles"
    ADD CONSTRAINT "app_user_roles_email_key" UNIQUE ("email");


--
-- Name: app_user_roles app_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_user_roles"
    ADD CONSTRAINT "app_user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: app_user_roles app_user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_user_roles"
    ADD CONSTRAINT "app_user_roles_user_id_key" UNIQUE ("user_id");


--
-- Name: clipboard clipboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."clipboard"
    ADD CONSTRAINT "clipboard_pkey" PRIMARY KEY ("id");


--
-- Name: clipboard clipboard_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."clipboard"
    ADD CONSTRAINT "clipboard_slug_key" UNIQUE ("slug");


--
-- Name: email_daily_counts email_daily_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."email_daily_counts"
    ADD CONSTRAINT "email_daily_counts_pkey" PRIMARY KEY ("date");


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");


--
-- Name: email_templates email_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_template_key_key" UNIQUE ("template_key");


--
-- Name: evaluation_criteria evaluation_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."evaluation_criteria"
    ADD CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id");


--
-- Name: external_pursuit_attachments external_pursuit_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_attachments"
    ADD CONSTRAINT "external_pursuit_attachments_pkey" PRIMARY KEY ("id");


--
-- Name: external_pursuit_attachments external_pursuit_attachments_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_attachments"
    ADD CONSTRAINT "external_pursuit_attachments_storage_path_key" UNIQUE ("storage_path");


--
-- Name: external_pursuit_audit_events external_pursuit_audit_events_external_pursuit_id_event_typ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_audit_events"
    ADD CONSTRAINT "external_pursuit_audit_events_external_pursuit_id_event_typ_key" UNIQUE ("external_pursuit_id", "event_type", "actor_user_id", "idempotency_key");


--
-- Name: external_pursuit_audit_events external_pursuit_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_audit_events"
    ADD CONSTRAINT "external_pursuit_audit_events_pkey" PRIMARY KEY ("id");


--
-- Name: external_pursuit_contacts external_pursuit_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_contacts"
    ADD CONSTRAINT "external_pursuit_contacts_pkey" PRIMARY KEY ("id");


--
-- Name: external_pursuit_deletion_tombstones external_pursuit_deletion_tombs_fulfillment_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_deletion_tombstones"
    ADD CONSTRAINT "external_pursuit_deletion_tombs_fulfillment_idempotency_key_key" UNIQUE ("fulfillment_idempotency_key");


--
-- Name: external_pursuit_deletion_tombstones external_pursuit_deletion_tombstones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_deletion_tombstones"
    ADD CONSTRAINT "external_pursuit_deletion_tombstones_pkey" PRIMARY KEY ("former_dossier_id");


--
-- Name: external_pursuit_notes external_pursuit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_notes"
    ADD CONSTRAINT "external_pursuit_notes_pkey" PRIMARY KEY ("external_pursuit_id");


--
-- Name: external_pursuit_opportunity_conversions external_pursuit_opportunity_c_converted_by_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_opportunity_conversions"
    ADD CONSTRAINT "external_pursuit_opportunity_c_converted_by_idempotency_key_key" UNIQUE ("converted_by", "idempotency_key");


--
-- Name: external_pursuit_opportunity_conversions external_pursuit_opportunity_conversions_opportunity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_opportunity_conversions"
    ADD CONSTRAINT "external_pursuit_opportunity_conversions_opportunity_id_key" UNIQUE ("opportunity_id");


--
-- Name: external_pursuit_opportunity_conversions external_pursuit_opportunity_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_opportunity_conversions"
    ADD CONSTRAINT "external_pursuit_opportunity_conversions_pkey" PRIMARY KEY ("external_pursuit_id");


--
-- Name: external_pursuit_staff_notes external_pursuit_staff_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_staff_notes"
    ADD CONSTRAINT "external_pursuit_staff_notes_pkey" PRIMARY KEY ("external_pursuit_id");


--
-- Name: external_pursuits external_pursuits_created_by_owner_repreneur_id_create_idem_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuits"
    ADD CONSTRAINT "external_pursuits_created_by_owner_repreneur_id_create_idem_key" UNIQUE ("created_by", "owner_repreneur_id", "create_idempotency_key");


--
-- Name: external_pursuits external_pursuits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuits"
    ADD CONSTRAINT "external_pursuits_pkey" PRIMARY KEY ("id");


--
-- Name: geography_nodes geography_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."geography_nodes"
    ADD CONSTRAINT "geography_nodes_pkey" PRIMARY KEY ("id");


--
-- Name: geography_nodes geography_nodes_stable_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."geography_nodes"
    ADD CONSTRAINT "geography_nodes_stable_key_key" UNIQUE ("stable_key");


--
-- Name: intake_abandonment_tracking intake_abandonment_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."intake_abandonment_tracking"
    ADD CONSTRAINT "intake_abandonment_tracking_pkey" PRIMARY KEY ("id");


--
-- Name: leadership_assessments leadership_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leadership_assessments"
    ADD CONSTRAINT "leadership_assessments_pkey" PRIMARY KEY ("id");


--
-- Name: leadership_assessments leadership_assessments_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leadership_assessments"
    ADD CONSTRAINT "leadership_assessments_token_key" UNIQUE ("token");


--
-- Name: ma_contact_email_policy_events ma_contact_email_policy_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_email_policy_events"
    ADD CONSTRAINT "ma_contact_email_policy_events_pkey" PRIMARY KEY ("id");


--
-- Name: ma_contact_office_affiliations ma_contact_office_affiliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_office_affiliations"
    ADD CONSTRAINT "ma_contact_office_affiliations_pkey" PRIMARY KEY ("id");


--
-- Name: ma_contacts ma_contacts_legacy_source_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contacts"
    ADD CONSTRAINT "ma_contacts_legacy_source_contact_id_key" UNIQUE ("legacy_source_contact_id");


--
-- Name: ma_contacts ma_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contacts"
    ADD CONSTRAINT "ma_contacts_pkey" PRIMARY KEY ("id");


--
-- Name: ma_cutover_runs ma_cutover_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_runs"
    ADD CONSTRAINT "ma_cutover_runs_pkey" PRIMARY KEY ("id");


--
-- Name: ma_cutover_stage_issues ma_cutover_stage_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_issues"
    ADD CONSTRAINT "ma_cutover_stage_issues_pkey" PRIMARY KEY ("id");


--
-- Name: ma_cutover_stage_rows ma_cutover_stage_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_rows"
    ADD CONSTRAINT "ma_cutover_stage_rows_pkey" PRIMARY KEY ("id");


--
-- Name: ma_cutover_stage_rows ma_cutover_stage_rows_run_id_entity_kind_temporary_entity_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_rows"
    ADD CONSTRAINT "ma_cutover_stage_rows_run_id_entity_kind_temporary_entity_i_key" UNIQUE ("run_id", "entity_kind", "temporary_entity_id");


--
-- Name: ma_cutover_stage_rows ma_cutover_stage_rows_run_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_rows"
    ADD CONSTRAINT "ma_cutover_stage_rows_run_id_id_key" UNIQUE ("run_id", "id");


--
-- Name: ma_firms ma_firms_legacy_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_firms"
    ADD CONSTRAINT "ma_firms_legacy_source_id_key" UNIQUE ("legacy_source_id");


--
-- Name: ma_firms ma_firms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_firms"
    ADD CONSTRAINT "ma_firms_pkey" PRIMARY KEY ("id");


--
-- Name: ma_interaction_delivery_events ma_interaction_delivery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interaction_delivery_events"
    ADD CONSTRAINT "ma_interaction_delivery_events_pkey" PRIMARY KEY ("id");


--
-- Name: ma_interaction_legacy_migration_manifest ma_interaction_legacy_migration_manifest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interaction_legacy_migration_manifest"
    ADD CONSTRAINT "ma_interaction_legacy_migration_manifest_pkey" PRIMARY KEY ("legacy_interaction_id");


--
-- Name: ma_interaction_owner_verification_events ma_interaction_owner_verification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interaction_owner_verification_events"
    ADD CONSTRAINT "ma_interaction_owner_verification_events_pkey" PRIMARY KEY ("id");


--
-- Name: ma_interactions ma_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interactions"
    ADD CONSTRAINT "ma_interactions_pkey" PRIMARY KEY ("id");


--
-- Name: ma_offices ma_offices_legacy_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_offices"
    ADD CONSTRAINT "ma_offices_legacy_source_id_key" UNIQUE ("legacy_source_id");


--
-- Name: ma_offices ma_offices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_offices"
    ADD CONSTRAINT "ma_offices_pkey" PRIMARY KEY ("id");


--
-- Name: ma_opportunity_date_correction_events ma_opportunity_date_correction_events_opportunity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_opportunity_date_correction_events"
    ADD CONSTRAINT "ma_opportunity_date_correction_events_opportunity_id_key" UNIQUE ("opportunity_id");


--
-- Name: ma_opportunity_date_correction_events ma_opportunity_date_correction_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_opportunity_date_correction_events"
    ADD CONSTRAINT "ma_opportunity_date_correction_events_pkey" PRIMARY KEY ("id");


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_affiliation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_affiliation_id_key" UNIQUE ("affiliation_id");


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_office_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_office_id_key" UNIQUE ("office_id");


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_pkey" PRIMARY KEY ("context_key");


--
-- Name: ma_provisional_source_review_events ma_provisional_source_review_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_review_events"
    ADD CONSTRAINT "ma_provisional_source_review_events_pkey" PRIMARY KEY ("id");


--
-- Name: ma_source_contact_moves ma_source_contact_moves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contact_moves"
    ADD CONSTRAINT "ma_source_contact_moves_pkey" PRIMARY KEY ("id");


--
-- Name: ma_source_contacts ma_source_contacts_id_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contacts"
    ADD CONSTRAINT "ma_source_contacts_id_source_id_key" UNIQUE ("id", "source_id");


--
-- Name: ma_source_contacts ma_source_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contacts"
    ADD CONSTRAINT "ma_source_contacts_pkey" PRIMARY KEY ("id");


--
-- Name: ma_source_email_send_reservations ma_source_email_send_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_email_send_reservations"
    ADD CONSTRAINT "ma_source_email_send_reservations_pkey" PRIMARY KEY ("opportunity_id");


--
-- Name: ma_source_email_send_reservations ma_source_email_send_reservations_reservation_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_email_send_reservations"
    ADD CONSTRAINT "ma_source_email_send_reservations_reservation_token_key" UNIQUE ("reservation_token");


--
-- Name: ma_source_interactions ma_source_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_interactions"
    ADD CONSTRAINT "ma_source_interactions_pkey" PRIMARY KEY ("id");


--
-- Name: ma_source_networks ma_source_networks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_networks"
    ADD CONSTRAINT "ma_source_networks_pkey" PRIMARY KEY ("id");


--
-- Name: ma_sources ma_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_sources"
    ADD CONSTRAINT "ma_sources_pkey" PRIMARY KEY ("id");


--
-- Name: ma_w039_geography_adoption_evidence ma_w039_geography_adoption_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_evidence"
    ADD CONSTRAINT "ma_w039_geography_adoption_evidence_pkey" PRIMARY KEY ("run_id", "opportunity_id");


--
-- Name: ma_w039_geography_adoption_runs ma_w039_geography_adoption_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_runs"
    ADD CONSTRAINT "ma_w039_geography_adoption_runs_pkey" PRIMARY KEY ("id");


--
-- Name: ma_w039_geography_adoption_runs ma_w039_geography_adoption_runs_source_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_runs"
    ADD CONSTRAINT "ma_w039_geography_adoption_runs_source_hash_key" UNIQUE ("source_hash");


--
-- Name: ma_w039_release_control ma_w039_release_control_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_release_control"
    ADD CONSTRAINT "ma_w039_release_control_pkey" PRIMARY KEY ("singleton");


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");


--
-- Name: notification_delivery_claims notification_delivery_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_delivery_claims"
    ADD CONSTRAINT "notification_delivery_claims_pkey" PRIMARY KEY ("idempotency_key");


--
-- Name: offer_milestones offer_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offer_milestones"
    ADD CONSTRAINT "offer_milestones_pkey" PRIMARY KEY ("id");


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");


--
-- Name: opportunities opportunities_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_reference_key" UNIQUE ("reference");


--
-- Name: opportunity_closure_history opportunity_closure_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_closure_history"
    ADD CONSTRAINT "opportunity_closure_history_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_documents opportunity_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_documents"
    ADD CONSTRAINT "opportunity_documents_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_documents opportunity_documents_repreneur_approval_evidence; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_documents"
    ADD CONSTRAINT "opportunity_documents_repreneur_approval_evidence" CHECK ((("visibility" <> 'approved_for_repreneur'::"public"."opportunity_document_visibility") OR (("repreneur_approved_at" IS NOT NULL) AND (NULLIF("btrim"("repreneur_approved_by"), ''::"text") IS NOT NULL)))) NOT VALID;


--
-- Name: opportunity_documents opportunity_documents_retained_staff_only; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_documents"
    ADD CONSTRAINT "opportunity_documents_retained_staff_only" CHECK (((("document_type")::"text" <> ALL (ARRAY['source_teaser'::"text", 'deal_book'::"text"])) OR ("visibility" = 'staff_only'::"public"."opportunity_document_visibility"))) NOT VALID;


--
-- Name: opportunity_ma_contacts opportunity_ma_contacts_opportunity_id_affiliation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_ma_contacts"
    ADD CONSTRAINT "opportunity_ma_contacts_opportunity_id_affiliation_id_key" UNIQUE ("opportunity_id", "affiliation_id");


--
-- Name: opportunity_ma_contacts opportunity_ma_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_ma_contacts"
    ADD CONSTRAINT "opportunity_ma_contacts_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_mandate_reference_counters opportunity_mandate_reference_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_mandate_reference_counters"
    ADD CONSTRAINT "opportunity_mandate_reference_counters_pkey" PRIMARY KEY ("reference_code");


--
-- Name: opportunity_matches opportunity_matches_opportunity_id_repreneur_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_opportunity_id_repreneur_id_key" UNIQUE ("opportunity_id", "repreneur_id");


--
-- Name: opportunity_matches opportunity_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_matches opportunity_matches_signed_requires_evidence; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_signed_requires_evidence" CHECK ((("nda_status" <> 'signed'::"public"."opportunity_nda_status") OR ("nda_signed_at" IS NOT NULL))) NOT VALID;


--
-- Name: opportunity_matches opportunity_matches_waived_requires_evidence; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_waived_requires_evidence" CHECK ((("nda_status" <> 'waived'::"public"."opportunity_nda_status") OR (("nda_waived_at" IS NOT NULL) AND (NULLIF("btrim"("nda_waived_by"), ''::"text") IS NOT NULL)))) NOT VALID;


--
-- Name: opportunity_memo_notifications opportunity_memo_notifications_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_memo_notifications"
    ADD CONSTRAINT "opportunity_memo_notifications_match_id_key" UNIQUE ("match_id");


--
-- Name: opportunity_memo_notifications opportunity_memo_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_memo_notifications"
    ADD CONSTRAINT "opportunity_memo_notifications_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_document_id_key" UNIQUE ("document_id");


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_supersedes_artifact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_supersedes_artifact_id_key" UNIQUE ("supersedes_artifact_id");


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_match_id_key" UNIQUE ("match_id");


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_pursuit_events opportunity_pursuit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_events"
    ADD CONSTRAINT "opportunity_pursuit_events_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_match_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_match_id_idempotency_key_key" UNIQUE ("match_id", "idempotency_key");


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_pkey" PRIMARY KEY ("id");


--
-- Name: opportunity_source_contacts opportunity_source_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_source_contacts"
    ADD CONSTRAINT "opportunity_source_contacts_pkey" PRIMARY KEY ("opportunity_id", "contact_id");


--
-- Name: pdr_feedback pdr_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_feedback"
    ADD CONSTRAINT "pdr_feedback_pkey" PRIMARY KEY ("id");


--
-- Name: pdr_goals pdr_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_goals"
    ADD CONSTRAINT "pdr_goals_pkey" PRIMARY KEY ("id");


--
-- Name: pdr_goals pdr_goals_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_goals"
    ADD CONSTRAINT "pdr_goals_slug_key" UNIQUE ("slug");


--
-- Name: pdr_milestones pdr_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_milestones"
    ADD CONSTRAINT "pdr_milestones_pkey" PRIMARY KEY ("id");


--
-- Name: pdr_milestones pdr_milestones_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_milestones"
    ADD CONSTRAINT "pdr_milestones_slug_key" UNIQUE ("slug");


--
-- Name: pdr_proposals pdr_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_proposals"
    ADD CONSTRAINT "pdr_proposals_pkey" PRIMARY KEY ("id");


--
-- Name: pdr_requests pdr_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_requests"
    ADD CONSTRAINT "pdr_requests_pkey" PRIMARY KEY ("id");


--
-- Name: pdr_work_cards pdr_work_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_work_cards"
    ADD CONSTRAINT "pdr_work_cards_pkey" PRIMARY KEY ("id");


--
-- Name: rateLimit rateLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rateLimit"
    ADD CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("key");


--
-- Name: repreneur_geography_targets repreneur_geography_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneur_geography_targets"
    ADD CONSTRAINT "repreneur_geography_targets_pkey" PRIMARY KEY ("repreneur_id", "geography_node_id");


--
-- Name: repreneur_offers repreneur_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneur_offers"
    ADD CONSTRAINT "repreneur_offers_pkey" PRIMARY KEY ("id");


--
-- Name: repreneurs repreneurs_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneurs"
    ADD CONSTRAINT "repreneurs_email_key" UNIQUE ("email");


--
-- Name: repreneurs repreneurs_flatchr_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneurs"
    ADD CONSTRAINT "repreneurs_flatchr_id_key" UNIQUE ("flatchr_id");


--
-- Name: repreneurs repreneurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneurs"
    ADD CONSTRAINT "repreneurs_pkey" PRIMARY KEY ("id");


--
-- Name: sector_taxonomy_legacy_20260720 sector_taxonomy_legacy_20260720_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sector_taxonomy_legacy_20260720"
    ADD CONSTRAINT "sector_taxonomy_legacy_20260720_pkey" PRIMARY KEY ("entity_type", "record_id", "field_name");


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("id");


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "session_token_key" UNIQUE ("token");


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");


--
-- Name: evaluation_criteria unique_tier_question_option; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."evaluation_criteria"
    ADD CONSTRAINT "unique_tier_question_option" UNIQUE ("tier", "question_key", "option_value");


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_email_key" UNIQUE ("email");


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."verification"
    ADD CONSTRAINT "verification_pkey" PRIMARY KEY ("id");


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");


--
-- Name: wave_journey_settings wave_journey_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wave_journey_settings"
    ADD CONSTRAINT "wave_journey_settings_pkey" PRIMARY KEY ("singleton");


--
-- Name: wavy_templates wavy_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."wavy_templates"
    ADD CONSTRAINT "wavy_templates_pkey" PRIMARY KEY ("id");


--
-- Name: external_pursuit_attachments_dossier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "external_pursuit_attachments_dossier_idx" ON "public"."external_pursuit_attachments" USING "btree" ("external_pursuit_id", "created_at");


--
-- Name: external_pursuit_audit_events_pursuit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "external_pursuit_audit_events_pursuit_idx" ON "public"."external_pursuit_audit_events" USING "btree" ("external_pursuit_id", "occurred_at");


--
-- Name: external_pursuit_contacts_pursuit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "external_pursuit_contacts_pursuit_idx" ON "public"."external_pursuit_contacts" USING "btree" ("external_pursuit_id", "created_at");


--
-- Name: external_pursuits_open_capacity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "external_pursuits_open_capacity_idx" ON "public"."external_pursuits" USING "btree" ("availability", "due_at", "last_confirmed_at") WHERE (("deletion_status" = 'active'::"public"."external_pursuit_deletion_status") AND ("stage" <> ALL (ARRAY['completed'::"public"."external_pursuit_stage", 'dropped_archived'::"public"."external_pursuit_stage"])));


--
-- Name: external_pursuits_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "external_pursuits_owner_idx" ON "public"."external_pursuits" USING "btree" ("owner_repreneur_id", "updated_at" DESC);


--
-- Name: idx_abandonment_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_abandonment_activity" ON "public"."intake_abandonment_tracking" USING "btree" ("last_activity_at");


--
-- Name: idx_abandonment_incomplete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_abandonment_incomplete" ON "public"."intake_abandonment_tracking" USING "btree" ("is_completed", "last_activity_at") WHERE ("is_completed" = false);


--
-- Name: idx_abandonment_repreneur_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_abandonment_repreneur_unique" ON "public"."intake_abandonment_tracking" USING "btree" ("repreneur_id");


--
-- Name: idx_activities_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activities_created_at" ON "public"."activities" USING "btree" ("created_at" DESC);


--
-- Name: idx_activities_repreneur_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activities_repreneur_created" ON "public"."activities" USING "btree" ("repreneur_id", "created_at" DESC);


--
-- Name: idx_activities_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activities_repreneur_id" ON "public"."activities" USING "btree" ("repreneur_id");


--
-- Name: idx_ai_generation_events_generation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_generation_events_generation" ON "public"."ai_generation_events" USING "btree" ("generation_id", "occurred_at");


--
-- Name: idx_ai_generation_events_type_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_generation_events_type_time" ON "public"."ai_generation_events" USING "btree" ("event_type", "occurred_at" DESC);


--
-- Name: idx_ai_generation_runs_actor_rate_limit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_generation_runs_actor_rate_limit" ON "public"."ai_generation_runs" USING "btree" ("initiated_by_user_id", "started_at" DESC);


--
-- Name: idx_ai_generation_runs_feature_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_generation_runs_feature_status" ON "public"."ai_generation_runs" USING "btree" ("feature", "status", "started_at" DESC);


--
-- Name: idx_ai_generation_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ai_generation_runs_started_at" ON "public"."ai_generation_runs" USING "btree" ("started_at" DESC);


--
-- Name: idx_app_user_roles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_user_roles_email" ON "public"."app_user_roles" USING "btree" ("lower"("email"));


--
-- Name: idx_app_user_roles_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_user_roles_repreneur_id" ON "public"."app_user_roles" USING "btree" ("repreneur_id");


--
-- Name: idx_app_user_roles_repreneur_role_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_app_user_roles_repreneur_role_unique" ON "public"."app_user_roles" USING "btree" ("repreneur_id") WHERE (("role" = 'repreneur'::"public"."app_user_role") AND ("repreneur_id" IS NOT NULL));


--
-- Name: idx_app_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_app_user_roles_role" ON "public"."app_user_roles" USING "btree" ("role");


--
-- Name: idx_assessment_repreneur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assessment_repreneur" ON "public"."leadership_assessments" USING "btree" ("repreneur_id");


--
-- Name: idx_assessment_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assessment_token" ON "public"."leadership_assessments" USING "btree" ("token");


--
-- Name: idx_email_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_created_at" ON "public"."email_logs" USING "btree" ("created_at");


--
-- Name: idx_email_logs_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_email_logs_idempotency_key" ON "public"."email_logs" USING "btree" ("idempotency_key");


--
-- Name: idx_email_logs_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_repreneur_id" ON "public"."email_logs" USING "btree" ("repreneur_id");


--
-- Name: idx_email_logs_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_sent_at" ON "public"."email_logs" USING "btree" ("sent_at");


--
-- Name: idx_email_logs_sent_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_sent_status" ON "public"."email_logs" USING "btree" ("sent_at" DESC, "status");


--
-- Name: idx_email_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_status" ON "public"."email_logs" USING "btree" ("status");


--
-- Name: idx_email_logs_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_template" ON "public"."email_logs" USING "btree" ("template_key");


--
-- Name: idx_email_logs_template_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_email_logs_template_key" ON "public"."email_logs" USING "btree" ("template_key");


--
-- Name: idx_evaluation_criteria_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_evaluation_criteria_active" ON "public"."evaluation_criteria" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_evaluation_criteria_question_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_evaluation_criteria_question_key" ON "public"."evaluation_criteria" USING "btree" ("question_key");


--
-- Name: idx_evaluation_criteria_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_evaluation_criteria_tier" ON "public"."evaluation_criteria" USING "btree" ("tier");


--
-- Name: idx_ma_contact_email_policy_events_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contact_email_policy_events_contact" ON "public"."ma_contact_email_policy_events" USING "btree" ("contact_id", "created_at" DESC);


--
-- Name: idx_ma_contact_email_policy_events_exception; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_contact_email_policy_events_exception" ON "public"."ma_contact_email_policy_events" USING "btree" ("contact_id", "opportunity_id", "purpose", "operation_key") WHERE ("event_type" = 'allowlisted_operational_send'::"text");


--
-- Name: idx_ma_contact_email_policy_events_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contact_email_policy_events_opportunity" ON "public"."ma_contact_email_policy_events" USING "btree" ("opportunity_id", "created_at" DESC) WHERE ("opportunity_id" IS NOT NULL);


--
-- Name: idx_ma_contact_email_policy_events_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_contact_email_policy_events_source" ON "public"."ma_contact_email_policy_events" USING "btree" ("contact_id", "source_key") WHERE ("source_key" IS NOT NULL);


--
-- Name: idx_ma_contact_office_affiliations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_contact_office_affiliations_active" ON "public"."ma_contact_office_affiliations" USING "btree" ("contact_id", "office_id") WHERE "is_active";


--
-- Name: idx_ma_contact_office_affiliations_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contact_office_affiliations_contact_id" ON "public"."ma_contact_office_affiliations" USING "btree" ("contact_id");


--
-- Name: idx_ma_contact_office_affiliations_legacy_bridge; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_contact_office_affiliations_legacy_bridge" ON "public"."ma_contact_office_affiliations" USING "btree" ("legacy_source_contact_id", "legacy_source_id") WHERE (("legacy_source_contact_id" IS NOT NULL) AND ("legacy_source_id" IS NOT NULL));


--
-- Name: idx_ma_contact_office_affiliations_legacy_source_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contact_office_affiliations_legacy_source_contact_id" ON "public"."ma_contact_office_affiliations" USING "btree" ("legacy_source_contact_id");


--
-- Name: idx_ma_contact_office_affiliations_legacy_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contact_office_affiliations_legacy_source_id" ON "public"."ma_contact_office_affiliations" USING "btree" ("legacy_source_id");


--
-- Name: idx_ma_contact_office_affiliations_office; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contact_office_affiliations_office" ON "public"."ma_contact_office_affiliations" USING "btree" ("office_id", "is_active", "contact_id");


--
-- Name: idx_ma_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_contacts_email" ON "public"."ma_contacts" USING "btree" ("lower"("btrim"("email"))) WHERE (NULLIF("btrim"("email"), ''::"text") IS NOT NULL);


--
-- Name: idx_ma_cutover_stage_issues_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_cutover_stage_issues_run_id" ON "public"."ma_cutover_stage_issues" USING "btree" ("run_id");


--
-- Name: idx_ma_cutover_stage_issues_stage_row_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_cutover_stage_issues_stage_row_id" ON "public"."ma_cutover_stage_issues" USING "btree" ("stage_row_id");


--
-- Name: idx_ma_cutover_stage_issues_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_cutover_stage_issues_unresolved" ON "public"."ma_cutover_stage_issues" USING "btree" ("run_id", "severity", "id") WHERE ("resolved_at" IS NULL);


--
-- Name: idx_ma_cutover_stage_rows_run_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_cutover_stage_rows_run_kind" ON "public"."ma_cutover_stage_rows" USING "btree" ("run_id", "entity_kind", "temporary_entity_id");


--
-- Name: idx_ma_firms_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_firms_name" ON "public"."ma_firms" USING "btree" ("lower"("btrim"("name")));


--
-- Name: idx_ma_interaction_delivery_events_interaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_interaction_delivery_events_interaction" ON "public"."ma_interaction_delivery_events" USING "btree" ("interaction_id", "occurred_at" DESC, "id" DESC);


--
-- Name: idx_ma_interaction_owner_verification_events_interaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_interaction_owner_verification_events_interaction" ON "public"."ma_interaction_owner_verification_events" USING "btree" ("interaction_id", "verified_at" DESC, "id" DESC);


--
-- Name: idx_ma_interactions_affiliation_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_interactions_affiliation_occurred_at" ON "public"."ma_interactions" USING "btree" ("affiliation_id", "occurred_at" DESC, "id" DESC) WHERE ("affiliation_id" IS NOT NULL);


--
-- Name: idx_ma_interactions_client_operation_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_interactions_client_operation_key" ON "public"."ma_interactions" USING "btree" ("client_operation_key") WHERE ("client_operation_key" IS NOT NULL);


--
-- Name: idx_ma_interactions_office_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_interactions_office_occurred_at" ON "public"."ma_interactions" USING "btree" ("office_id", "occurred_at" DESC, "id" DESC);


--
-- Name: idx_ma_interactions_opportunity_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_interactions_opportunity_occurred_at" ON "public"."ma_interactions" USING "btree" ("opportunity_id", "occurred_at" DESC, "id" DESC) WHERE ("opportunity_id" IS NOT NULL);


--
-- Name: idx_ma_interactions_pending_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_interactions_pending_opportunity" ON "public"."ma_interactions" USING "btree" ("opportunity_id") WHERE (("delivery_status" = 'pending'::"text") AND ("opportunity_id" IS NOT NULL));


--
-- Name: idx_ma_interactions_provider_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_interactions_provider_idempotency_key" ON "public"."ma_interactions" USING "btree" ("provider_idempotency_key") WHERE ("provider_idempotency_key" IS NOT NULL);


--
-- Name: idx_ma_offices_active_real_name_per_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_offices_active_real_name_per_firm" ON "public"."ma_offices" USING "btree" ("firm_id", "lower"("btrim"("name"))) WHERE (("status" = 'active'::"text") AND (NOT "is_default"));


--
-- Name: idx_ma_offices_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_offices_firm" ON "public"."ma_offices" USING "btree" ("firm_id", "name") WHERE ("status" = 'active'::"text");


--
-- Name: idx_ma_offices_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_offices_firm_id" ON "public"."ma_offices" USING "btree" ("firm_id");


--
-- Name: idx_ma_offices_one_synthetic_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_offices_one_synthetic_default" ON "public"."ma_offices" USING "btree" ("firm_id") WHERE "is_default";


--
-- Name: idx_ma_provisional_source_review_events_one_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_provisional_source_review_events_one_resolution" ON "public"."ma_provisional_source_review_events" USING "btree" ("related_assignment_id") WHERE ("event_kind" = 'resolved'::"text");


--
-- Name: idx_ma_provisional_source_review_events_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_provisional_source_review_events_opportunity" ON "public"."ma_provisional_source_review_events" USING "btree" ("opportunity_id", "occurred_at" DESC, "id" DESC);


--
-- Name: idx_ma_provisional_source_review_events_related_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_provisional_source_review_events_related_assignment" ON "public"."ma_provisional_source_review_events" USING "btree" ("related_assignment_id") WHERE ("related_assignment_id" IS NOT NULL);


--
-- Name: idx_ma_source_contact_moves_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_contact_moves_contact" ON "public"."ma_source_contact_moves" USING "btree" ("contact_id", "moved_at" DESC);


--
-- Name: idx_ma_source_contacts_canonical_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_source_contacts_canonical_contact" ON "public"."ma_source_contacts" USING "btree" ("canonical_contact_id") WHERE ("canonical_contact_id" IS NOT NULL);


--
-- Name: idx_ma_source_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_contacts_email" ON "public"."ma_source_contacts" USING "btree" ("lower"("btrim"("email"))) WHERE (NULLIF("btrim"("email"), ''::"text") IS NOT NULL);


--
-- Name: idx_ma_source_contacts_legacy_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_source_contacts_legacy_source_id" ON "public"."ma_source_contacts" USING "btree" ("legacy_source_id") WHERE ("legacy_source_id" IS NOT NULL);


--
-- Name: idx_ma_source_contacts_office_affiliation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_contacts_office_affiliation_id" ON "public"."ma_source_contacts" USING "btree" ("office_affiliation_id");


--
-- Name: idx_ma_source_contacts_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_contacts_source_id" ON "public"."ma_source_contacts" USING "btree" ("source_id", "name");


--
-- Name: idx_ma_source_email_send_reservations_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_email_send_reservations_expiry" ON "public"."ma_source_email_send_reservations" USING "btree" ("expires_at");


--
-- Name: idx_ma_source_interactions_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_interactions_contact" ON "public"."ma_source_interactions" USING "btree" ("contact_id", "created_at" DESC) WHERE ("contact_id" IS NOT NULL);


--
-- Name: idx_ma_source_interactions_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_interactions_opportunity" ON "public"."ma_source_interactions" USING "btree" ("opportunity_id", "created_at" DESC);


--
-- Name: idx_ma_source_interactions_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_source_interactions_source" ON "public"."ma_source_interactions" USING "btree" ("source_id", "created_at" DESC) WHERE ("source_id" IS NOT NULL);


--
-- Name: idx_ma_source_networks_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_source_networks_name" ON "public"."ma_source_networks" USING "btree" ("lower"("btrim"("name")));


--
-- Name: idx_ma_sources_contact_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_sources_contact_email" ON "public"."ma_sources" USING "btree" ("lower"("contact_email")) WHERE ("contact_email" IS NOT NULL);


--
-- Name: idx_ma_sources_default_office_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_sources_default_office_id" ON "public"."ma_sources" USING "btree" ("default_office_id");


--
-- Name: idx_ma_sources_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_ma_sources_firm_id" ON "public"."ma_sources" USING "btree" ("firm_id") WHERE ("firm_id" IS NOT NULL);


--
-- Name: idx_ma_sources_firm_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_sources_firm_name" ON "public"."ma_sources" USING "btree" ("firm_name");


--
-- Name: idx_ma_sources_network_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_sources_network_id" ON "public"."ma_sources" USING "btree" ("network_id", "firm_name") WHERE ("network_id" IS NOT NULL);


--
-- Name: idx_ma_sources_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_ma_sources_type" ON "public"."ma_sources" USING "btree" ("source_type");


--
-- Name: idx_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notes_created_at" ON "public"."notes" USING "btree" ("created_at" DESC);


--
-- Name: idx_notes_repreneur_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notes_repreneur_created" ON "public"."notes" USING "btree" ("repreneur_id", "created_at" DESC);


--
-- Name: idx_notes_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notes_repreneur_id" ON "public"."notes" USING "btree" ("repreneur_id");


--
-- Name: idx_offers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_offers_is_active" ON "public"."offers" USING "btree" ("is_active");


--
-- Name: idx_opportunities_date_added; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_date_added" ON "public"."opportunities" USING "btree" ("date_added");


--
-- Name: idx_opportunities_geography_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_geography_node" ON "public"."opportunities" USING "btree" ("geography_node_id") WHERE ("geography_node_id" IS NOT NULL);


--
-- Name: idx_opportunities_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_location" ON "public"."opportunities" USING "btree" ("location");


--
-- Name: idx_opportunities_repreneur_exposure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_repreneur_exposure" ON "public"."opportunities" USING "btree" ("repreneur_exposure");


--
-- Name: idx_opportunities_repreneur_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_repreneur_visibility" ON "public"."opportunities" USING "btree" ("repreneur_visibility");


--
-- Name: idx_opportunities_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_sector" ON "public"."opportunities" USING "btree" ("sector");


--
-- Name: idx_opportunities_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_source_id" ON "public"."opportunities" USING "btree" ("source_id");


--
-- Name: idx_opportunities_source_office; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_source_office" ON "public"."opportunities" USING "btree" ("source_office_id") WHERE ("source_office_id" IS NOT NULL);


--
-- Name: idx_opportunities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunities_status" ON "public"."opportunities" USING "btree" ("status");


--
-- Name: idx_opportunity_closure_history_opportunity_closed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_closure_history_opportunity_closed_at" ON "public"."opportunity_closure_history" USING "btree" ("opportunity_id", "closed_at" DESC);


--
-- Name: idx_opportunity_documents_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_documents_opportunity_id" ON "public"."opportunity_documents" USING "btree" ("opportunity_id");


--
-- Name: idx_opportunity_documents_repreneur_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_documents_repreneur_approval" ON "public"."opportunity_documents" USING "btree" ("opportunity_id", "uploaded_at" DESC) WHERE (("visibility" = 'approved_for_repreneur'::"public"."opportunity_document_visibility") AND ("repreneur_approved_at" IS NOT NULL));


--
-- Name: idx_opportunity_documents_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_documents_visibility" ON "public"."opportunity_documents" USING "btree" ("visibility");


--
-- Name: idx_opportunity_ma_contacts_affiliation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_ma_contacts_affiliation" ON "public"."opportunity_ma_contacts" USING "btree" ("affiliation_id") WHERE "is_active";


--
-- Name: idx_opportunity_ma_contacts_affiliation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_ma_contacts_affiliation_id" ON "public"."opportunity_ma_contacts" USING "btree" ("affiliation_id");


--
-- Name: idx_opportunity_ma_contacts_legacy_source_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_ma_contacts_legacy_source_contact_id" ON "public"."opportunity_ma_contacts" USING "btree" ("legacy_source_contact_id");


--
-- Name: idx_opportunity_ma_contacts_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_ma_contacts_opportunity" ON "public"."opportunity_ma_contacts" USING "btree" ("opportunity_id", "is_active" DESC, "is_primary" DESC);


--
-- Name: idx_opportunity_ma_contacts_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_opportunity_ma_contacts_primary" ON "public"."opportunity_ma_contacts" USING "btree" ("opportunity_id") WHERE ("is_active" AND "is_primary");


--
-- Name: idx_opportunity_matches_nda_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_nda_document_id" ON "public"."opportunity_matches" USING "btree" ("nda_document_id");


--
-- Name: idx_opportunity_matches_nda_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_nda_signed_at" ON "public"."opportunity_matches" USING "btree" ("nda_signed_at") WHERE ("nda_signed_at" IS NOT NULL);


--
-- Name: idx_opportunity_matches_nda_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_nda_status" ON "public"."opportunity_matches" USING "btree" ("nda_status");


--
-- Name: idx_opportunity_matches_one_active_pursuit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_opportunity_matches_one_active_pursuit" ON "public"."opportunity_matches" USING "btree" ("opportunity_id") WHERE ("status" = 'active_pursuit'::"public"."opportunity_match_status");


--
-- Name: idx_opportunity_matches_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_opportunity_id" ON "public"."opportunity_matches" USING "btree" ("opportunity_id");


--
-- Name: idx_opportunity_matches_platform_recommendation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_platform_recommendation" ON "public"."opportunity_matches" USING "btree" ("platform_recommendation");


--
-- Name: idx_opportunity_matches_pursuit_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_pursuit_stage" ON "public"."opportunity_matches" USING "btree" ("pursuit_stage");


--
-- Name: idx_opportunity_matches_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_repreneur_id" ON "public"."opportunity_matches" USING "btree" ("repreneur_id");


--
-- Name: idx_opportunity_matches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_matches_status" ON "public"."opportunity_matches" USING "btree" ("status");


--
-- Name: idx_opportunity_memo_notifications_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_memo_notifications_retry" ON "public"."opportunity_memo_notifications" USING "btree" ("status", "last_attempt_at") WHERE ("sent_at" IS NULL);


--
-- Name: idx_opportunity_pursuit_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_pursuit_events_created_at" ON "public"."opportunity_pursuit_events" USING "btree" ("created_at" DESC);


--
-- Name: idx_opportunity_pursuit_events_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_pursuit_events_match_id" ON "public"."opportunity_pursuit_events" USING "btree" ("match_id");


--
-- Name: idx_opportunity_pursuit_events_opportunity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_pursuit_events_opportunity_id" ON "public"."opportunity_pursuit_events" USING "btree" ("opportunity_id");


--
-- Name: idx_opportunity_pursuit_events_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_pursuit_events_repreneur_id" ON "public"."opportunity_pursuit_events" USING "btree" ("repreneur_id");


--
-- Name: idx_opportunity_source_contacts_canonical_link; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_opportunity_source_contacts_canonical_link" ON "public"."opportunity_source_contacts" USING "btree" ("canonical_opportunity_contact_id") WHERE ("canonical_opportunity_contact_id" IS NOT NULL);


--
-- Name: idx_opportunity_source_contacts_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_source_contacts_contact" ON "public"."opportunity_source_contacts" USING "btree" ("contact_id");


--
-- Name: idx_opportunity_source_contacts_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_opportunity_source_contacts_opportunity" ON "public"."opportunity_source_contacts" USING "btree" ("opportunity_id", "is_primary" DESC);


--
-- Name: idx_opportunity_source_contacts_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_opportunity_source_contacts_primary" ON "public"."opportunity_source_contacts" USING "btree" ("opportunity_id") WHERE "is_primary";


--
-- Name: idx_repreneur_geography_targets_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneur_geography_targets_node" ON "public"."repreneur_geography_targets" USING "btree" ("geography_node_id", "repreneur_id");


--
-- Name: idx_repreneur_offers_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneur_offers_offer_id" ON "public"."repreneur_offers" USING "btree" ("offer_id");


--
-- Name: idx_repreneur_offers_repreneur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneur_offers_repreneur_id" ON "public"."repreneur_offers" USING "btree" ("repreneur_id");


--
-- Name: idx_repreneur_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneur_offers_status" ON "public"."repreneur_offers" USING "btree" ("status");


--
-- Name: idx_repreneurs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneurs_created_at" ON "public"."repreneurs" USING "btree" ("created_at" DESC);


--
-- Name: idx_repreneurs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneurs_created_by" ON "public"."repreneurs" USING "btree" ("created_by");


--
-- Name: idx_repreneurs_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneurs_email" ON "public"."repreneurs" USING "btree" ("email");


--
-- Name: idx_repreneurs_flatchr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneurs_flatchr_id" ON "public"."repreneurs" USING "btree" ("flatchr_id");


--
-- Name: idx_repreneurs_lifecycle_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneurs_lifecycle_created" ON "public"."repreneurs" USING "btree" ("lifecycle_status", "created_at" DESC);


--
-- Name: idx_repreneurs_lifecycle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_repreneurs_lifecycle_status" ON "public"."repreneurs" USING "btree" ("lifecycle_status");


--
-- Name: idx_tasks_expected_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tasks_expected_end" ON "public"."tasks" USING "btree" ("expected_end_date");


--
-- Name: idx_tasks_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tasks_owner" ON "public"."tasks" USING "btree" ("owner_id");


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");


--
-- Name: idx_tasks_stream; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tasks_stream" ON "public"."tasks" USING "btree" ("stream");


--
-- Name: idx_waitlist_promoted_repreneur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_waitlist_promoted_repreneur" ON "public"."waitlist" USING "btree" ("promoted_repreneur_id") WHERE ("promoted_repreneur_id" IS NOT NULL);


--
-- Name: idx_wavy_templates_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_wavy_templates_channel" ON "public"."wavy_templates" USING "btree" ("channel");


--
-- Name: opportunity_nda_artifacts_blank_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "opportunity_nda_artifacts_blank_version_unique" ON "public"."opportunity_nda_artifacts" USING "btree" ("opportunity_id", "artifact_role", "version_number") WHERE ("match_id" IS NULL);


--
-- Name: opportunity_nda_artifacts_match_recorded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "opportunity_nda_artifacts_match_recorded_idx" ON "public"."opportunity_nda_artifacts" USING "btree" ("match_id", "recorded_at" DESC) WHERE ("match_id" IS NOT NULL);


--
-- Name: opportunity_nda_artifacts_opportunity_recorded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "opportunity_nda_artifacts_opportunity_recorded_idx" ON "public"."opportunity_nda_artifacts" USING "btree" ("opportunity_id", "recorded_at" DESC);


--
-- Name: opportunity_nda_artifacts_pursuit_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "opportunity_nda_artifacts_pursuit_version_unique" ON "public"."opportunity_nda_artifacts" USING "btree" ("match_id", "artifact_role", "version_number") WHERE ("match_id" IS NOT NULL);


--
-- Name: opportunity_nda_artifacts_signed_content_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "opportunity_nda_artifacts_signed_content_unique" ON "public"."opportunity_nda_artifacts" USING "btree" ("match_id", "artifact_role", "content_sha256") WHERE (("match_id" IS NOT NULL) AND ("artifact_role" = ANY (ARRAY['renew_signed_copy'::"public"."opportunity_nda_artifact_role", 'repreneur_signed_copy'::"public"."opportunity_nda_artifact_role"])));


--
-- Name: opportunity_pursuit_evidence_match_recorded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "opportunity_pursuit_evidence_match_recorded_idx" ON "public"."opportunity_pursuit_evidence" USING "btree" ("match_id", "recorded_at" DESC);


--
-- Name: opportunity_pursuit_evidence_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "opportunity_pursuit_evidence_type_idx" ON "public"."opportunity_pursuit_evidence" USING "btree" ("match_id", "event_type", "recorded_at" DESC);


--
-- Name: pdr_feedback_card_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_feedback_card_created_idx" ON "public"."pdr_feedback" USING "btree" ("work_card_id", "created_at");


--
-- Name: pdr_proposals_bundle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_proposals_bundle_idx" ON "public"."pdr_proposals" USING "btree" ("suggested_bundle_id");


--
-- Name: pdr_proposals_conversion_token_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "pdr_proposals_conversion_token_uidx" ON "public"."pdr_proposals" USING "btree" ("conversion_token");


--
-- Name: pdr_proposals_goal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_proposals_goal_id_idx" ON "public"."pdr_proposals" USING "btree" ("suggested_goal_id");


--
-- Name: pdr_proposals_match_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_proposals_match_idx" ON "public"."pdr_proposals" USING "btree" ("matched_work_card_id");


--
-- Name: pdr_proposals_milestone_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_proposals_milestone_id_idx" ON "public"."pdr_proposals" USING "btree" ("suggested_milestone_id");


--
-- Name: pdr_proposals_pending_match_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_proposals_pending_match_idx" ON "public"."pdr_proposals" USING "btree" ("matched_proposal_id");


--
-- Name: pdr_proposals_status_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_proposals_status_updated_idx" ON "public"."pdr_proposals" USING "btree" ("status", "updated_at" DESC);


--
-- Name: pdr_requests_goal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_requests_goal_id_idx" ON "public"."pdr_requests" USING "btree" ("goal_id");


--
-- Name: pdr_requests_milestone_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_requests_milestone_id_idx" ON "public"."pdr_requests" USING "btree" ("milestone_id");


--
-- Name: pdr_work_cards_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_work_cards_active_idx" ON "public"."pdr_work_cards" USING "btree" ("status", "sort_order", "updated_at" DESC) WHERE ("archived_at" IS NULL);


--
-- Name: pdr_work_cards_completed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_work_cards_completed_at_idx" ON "public"."pdr_work_cards" USING "btree" ("completed_at") WHERE (("archived_at" IS NULL) AND ("status" = 'done'::"text") AND ("completed_at" IS NOT NULL));


--
-- Name: pdr_work_cards_reference_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "pdr_work_cards_reference_number_uidx" ON "public"."pdr_work_cards" USING "btree" ("reference_number");


--
-- Name: pdr_work_cards_source_proposal_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "pdr_work_cards_source_proposal_uidx" ON "public"."pdr_work_cards" USING "btree" ("source_proposal_id") WHERE ("source_proposal_id" IS NOT NULL);


--
-- Name: pdr_work_cards_status_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_work_cards_status_sort_idx" ON "public"."pdr_work_cards" USING "btree" ("status", "sort_order", "updated_at" DESC);


--
-- Name: pdr_work_cards_strategic_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pdr_work_cards_strategic_item_id_idx" ON "public"."pdr_work_cards" USING "btree" ("strategic_item_id");


--
-- Name: rate_limit_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "rate_limit_id_uidx" ON "public"."rateLimit" USING "btree" ("id");


--
-- Name: repreneur_offers_one_open_offer_per_repreneur; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "repreneur_offers_one_open_offer_per_repreneur" ON "public"."repreneur_offers" USING "btree" ("repreneur_id", "offer_id") WHERE ("status" = ANY (ARRAY['offered'::"public"."repreneur_offer_status", 'accepted'::"public"."repreneur_offer_status"]));


--
-- Name: opportunity_ma_contacts capture_opportunity_ma_contact_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "capture_opportunity_ma_contact_snapshot" BEFORE INSERT ON "public"."opportunity_ma_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."capture_opportunity_ma_contact_snapshot"();


--
-- Name: opportunity_source_contacts capture_opportunity_source_contact_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "capture_opportunity_source_contact_snapshot" BEFORE INSERT ON "public"."opportunity_source_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."capture_opportunity_source_contact_snapshot"();


--
-- Name: ma_firms enforce_ma_firm_active_office_on_firm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_ma_firm_active_office_on_firm" AFTER INSERT OR DELETE OR UPDATE ON "public"."ma_firms" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ma_firm_active_office"();


--
-- Name: ma_offices enforce_ma_firm_active_office_on_office; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_ma_firm_active_office_on_office" AFTER INSERT OR DELETE OR UPDATE ON "public"."ma_offices" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ma_firm_active_office"();


--
-- Name: ma_interactions enforce_ma_interaction_office_context; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_ma_interaction_office_context" BEFORE INSERT OR UPDATE ON "public"."ma_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ma_interaction_office_context"();


--
-- Name: ma_provisional_source_review_events enforce_ma_provisional_source_review_on_event; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_ma_provisional_source_review_on_event" AFTER INSERT ON "public"."ma_provisional_source_review_events" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ma_provisional_source_review_on_event"();


--
-- Name: opportunities enforce_ma_provisional_source_review_on_opportunity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_ma_provisional_source_review_on_opportunity" AFTER INSERT OR UPDATE OF "source_office_id", "status" ON "public"."opportunities" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ma_provisional_source_review_on_opportunity"();


--
-- Name: ma_contact_office_affiliations enforce_opportunity_office_context_on_affiliation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_opportunity_office_context_on_affiliation" AFTER INSERT OR DELETE OR UPDATE ON "public"."ma_contact_office_affiliations" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_opportunity_office_context"();


--
-- Name: ma_contacts enforce_opportunity_office_context_on_contact; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_opportunity_office_context_on_contact" AFTER INSERT OR DELETE OR UPDATE ON "public"."ma_contacts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_opportunity_office_context"();


--
-- Name: opportunity_ma_contacts enforce_opportunity_office_context_on_link; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_opportunity_office_context_on_link" AFTER INSERT OR DELETE OR UPDATE ON "public"."opportunity_ma_contacts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_opportunity_office_context"();


--
-- Name: ma_offices enforce_opportunity_office_context_on_office; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_opportunity_office_context_on_office" AFTER INSERT OR DELETE OR UPDATE ON "public"."ma_offices" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_opportunity_office_context"();


--
-- Name: opportunities enforce_opportunity_office_context_on_opportunity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER "enforce_opportunity_office_context_on_opportunity" AFTER INSERT OR DELETE OR UPDATE ON "public"."opportunities" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."enforce_opportunity_office_context"();


--
-- Name: opportunity_source_contacts enforce_opportunity_source_contact_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_opportunity_source_contact_integrity" BEFORE INSERT OR UPDATE OF "opportunity_id", "source_id", "contact_id" ON "public"."opportunity_source_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_opportunity_source_contact_integrity"();


--
-- Name: external_pursuit_audit_events external_pursuit_audit_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "external_pursuit_audit_events_immutable" BEFORE DELETE OR UPDATE ON "public"."external_pursuit_audit_events" FOR EACH ROW EXECUTE FUNCTION "public"."reject_external_pursuit_audit_mutation"();


--
-- Name: external_pursuit_opportunity_conversions external_pursuit_opportunity_conversions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "external_pursuit_opportunity_conversions_immutable" BEFORE DELETE OR UPDATE ON "public"."external_pursuit_opportunity_conversions" FOR EACH ROW EXECUTE FUNCTION "public"."reject_external_pursuit_conversion_mutation"();


--
-- Name: ma_contacts guard_ma_contact_campaign_email_suppression; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_contact_campaign_email_suppression" BEFORE UPDATE OF "campaign_email_suppressed", "campaign_email_suppression_reason" ON "public"."ma_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_contact_campaign_email_suppression"();


--
-- Name: ma_cutover_runs guard_ma_cutover_run_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_cutover_run_insert" BEFORE INSERT ON "public"."ma_cutover_runs" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_cutover_run_insert"();


--
-- Name: ma_cutover_runs guard_ma_cutover_runs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_cutover_runs" BEFORE UPDATE ON "public"."ma_cutover_runs" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_cutover_run_immutability"();


--
-- Name: ma_cutover_stage_issues guard_ma_cutover_stage_issues; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_cutover_stage_issues" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ma_cutover_stage_issues" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_cutover_stage_mutation"();


--
-- Name: ma_cutover_stage_rows guard_ma_cutover_stage_rows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_cutover_stage_rows" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ma_cutover_stage_rows" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_cutover_stage_mutation"();


--
-- Name: ma_interactions guard_ma_interaction_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_interaction_mutation" BEFORE DELETE OR UPDATE ON "public"."ma_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_interaction_mutation"();


--
-- Name: opportunities guard_ma_interaction_opportunity_source_office; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_interaction_opportunity_source_office" BEFORE UPDATE OF "source_office_id" ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_interaction_opportunity_source_office"();


--
-- Name: ma_firms guard_ma_provisional_acme_firm_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_acme_firm_identity" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ma_firms" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_acme_firm_identity"();


--
-- Name: ma_offices guard_ma_provisional_acme_office_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_acme_office_identity" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ma_offices" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_acme_office_identity"();


--
-- Name: ma_contact_office_affiliations guard_ma_provisional_qa_person_affiliation_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_qa_person_affiliation_identity" BEFORE DELETE OR UPDATE ON "public"."ma_contact_office_affiliations" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_qa_person_affiliation_identity"();


--
-- Name: ma_contacts guard_ma_provisional_qa_person_contact_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_qa_person_contact_identity" BEFORE INSERT OR DELETE OR UPDATE ON "public"."ma_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_qa_person_contact_identity"();


--
-- Name: ma_provisional_source_contexts guard_ma_provisional_source_context_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_source_context_identity" BEFORE DELETE OR UPDATE ON "public"."ma_provisional_source_contexts" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_source_context_identity"();


--
-- Name: ma_cutover_runs guard_ma_provisional_source_cutover_on_run; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_source_cutover_on_run" BEFORE UPDATE OF "status" ON "public"."ma_cutover_runs" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_source_cutover"();


--
-- Name: ma_provisional_source_review_events guard_ma_provisional_source_review_event_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_ma_provisional_source_review_event_insert" BEFORE INSERT ON "public"."ma_provisional_source_review_events" FOR EACH ROW EXECUTE FUNCTION "public"."guard_ma_provisional_source_review_event"();


--
-- Name: opportunities guard_opportunity_source_contact_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "guard_opportunity_source_contact_integrity" BEFORE UPDATE OF "source_id" ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."guard_opportunity_source_contact_integrity"();


--
-- Name: ma_contacts normalize_ma_contact_display_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "normalize_ma_contact_display_name" BEFORE INSERT OR UPDATE OF "first_name", "last_name" ON "public"."ma_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_ma_contact_display_name"();


--
-- Name: opportunity_documents opportunity_documents_protect_nda_artifacts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "opportunity_documents_protect_nda_artifacts" BEFORE DELETE OR UPDATE ON "public"."opportunity_documents" FOR EACH ROW EXECUTE FUNCTION "public"."reject_linked_nda_document_mutation"();


--
-- Name: opportunity_documents opportunity_documents_retain_source_and_im; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "opportunity_documents_retain_source_and_im" BEFORE DELETE ON "public"."opportunity_documents" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_retained_opportunity_document_delete"();


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "opportunity_nda_artifacts_immutable" BEFORE DELETE OR UPDATE ON "public"."opportunity_nda_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."reject_opportunity_nda_artifact_mutation"();


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_validate_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "opportunity_nda_artifacts_validate_integrity" BEFORE INSERT ON "public"."opportunity_nda_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."assert_opportunity_nda_artifact_integrity"();


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "opportunity_pursuit_evidence_immutable" BEFORE DELETE OR UPDATE ON "public"."opportunity_pursuit_evidence" FOR EACH ROW EXECUTE FUNCTION "public"."reject_opportunity_pursuit_evidence_mutation"();


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "opportunity_pursuit_evidence_integrity" BEFORE INSERT ON "public"."opportunity_pursuit_evidence" FOR EACH ROW EXECUTE FUNCTION "public"."assert_opportunity_pursuit_evidence_integrity"();


--
-- Name: pdr_work_cards pdr_work_cards_set_completed_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "pdr_work_cards_set_completed_at" BEFORE INSERT OR UPDATE OF "status", "completed_at" ON "public"."pdr_work_cards" FOR EACH ROW EXECUTE FUNCTION "public"."pdr_set_work_card_completed_at"();


--
-- Name: ma_contact_email_policy_events prevent_ma_contact_email_policy_event_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_contact_email_policy_event_mutation" BEFORE DELETE OR UPDATE ON "public"."ma_contact_email_policy_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_contact_email_policy_event_mutation"();


--
-- Name: ma_cutover_runs prevent_ma_cutover_run_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_cutover_run_delete" BEFORE DELETE ON "public"."ma_cutover_runs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_cutover_run_delete"();


--
-- Name: ma_interaction_delivery_events prevent_ma_interaction_delivery_event_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_interaction_delivery_event_mutation" BEFORE DELETE OR UPDATE ON "public"."ma_interaction_delivery_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_interaction_delivery_event_mutation"();


--
-- Name: ma_interaction_owner_verification_events prevent_ma_interaction_owner_verification_event_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_interaction_owner_verification_event_mutation" BEFORE DELETE OR UPDATE ON "public"."ma_interaction_owner_verification_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_interaction_owner_verification_event_mutation"();


--
-- Name: ma_opportunity_date_correction_events prevent_ma_opportunity_date_correction_event_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_opportunity_date_correction_event_mutation" BEFORE DELETE OR UPDATE ON "public"."ma_opportunity_date_correction_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_opportunity_date_correction_event_mutation"();


--
-- Name: ma_provisional_source_review_events prevent_ma_provisional_source_review_event_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_provisional_source_review_event_delete" BEFORE DELETE ON "public"."ma_provisional_source_review_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_provisional_source_review_event_mutation"();


--
-- Name: ma_provisional_source_review_events prevent_ma_provisional_source_review_event_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_provisional_source_review_event_update" BEFORE UPDATE ON "public"."ma_provisional_source_review_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_provisional_source_review_event_mutation"();


--
-- Name: ma_source_contact_moves prevent_ma_source_contact_move_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_source_contact_move_delete" BEFORE DELETE ON "public"."ma_source_contact_moves" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_source_contact_move_mutation"();


--
-- Name: ma_source_contact_moves prevent_ma_source_contact_move_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_ma_source_contact_move_update" BEFORE UPDATE ON "public"."ma_source_contact_moves" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ma_source_contact_move_mutation"();


--
-- Name: opportunity_closure_history prevent_opportunity_closure_history_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_opportunity_closure_history_mutation" BEFORE DELETE OR UPDATE ON "public"."opportunity_closure_history" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_opportunity_closure_history_mutation"();


--
-- Name: opportunities prevent_opportunity_reference_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_opportunity_reference_change" BEFORE UPDATE OF "reference" ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_opportunity_reference_change"();


--
-- Name: ma_w039_geography_adoption_evidence prevent_w039_geography_adoption_evidence_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "prevent_w039_geography_adoption_evidence_mutation" BEFORE DELETE OR UPDATE ON "public"."ma_w039_geography_adoption_evidence" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_w039_geography_adoption_evidence_mutation"();


--
-- Name: opportunities sync_opportunity_date_added_precision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "sync_opportunity_date_added_precision" BEFORE INSERT OR UPDATE OF "date_added" ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."sync_opportunity_date_added_precision"();


--
-- Name: repreneurs sync_repreneur_geography_targets_from_legacy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "sync_repreneur_geography_targets_from_legacy" AFTER INSERT OR UPDATE OF "q12_geo_zones", "target_location" ON "public"."repreneurs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_repreneur_geography_targets_from_legacy"();


--
-- Name: tasks tasks_auto_dates_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tasks_auto_dates_trigger" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_actual_start"();


--
-- Name: tasks tasks_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "tasks_updated_at_trigger" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_tasks_updated_at"();


--
-- Name: repreneurs trg_update_journey_stage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_update_journey_stage" BEFORE INSERT OR UPDATE ON "public"."repreneurs" FOR EACH ROW EXECUTE FUNCTION "public"."update_journey_stage_trigger"();


--
-- Name: app_user_roles update_app_user_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_app_user_roles_updated_at" BEFORE UPDATE ON "public"."app_user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: evaluation_criteria update_evaluation_criteria_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_evaluation_criteria_updated_at" BEFORE UPDATE ON "public"."evaluation_criteria" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_contact_office_affiliations update_ma_contact_office_affiliations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_contact_office_affiliations_updated_at" BEFORE UPDATE ON "public"."ma_contact_office_affiliations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_contacts update_ma_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_contacts_updated_at" BEFORE UPDATE ON "public"."ma_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_cutover_runs update_ma_cutover_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_cutover_runs_updated_at" BEFORE UPDATE ON "public"."ma_cutover_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_ma_cutover_updated_at"();


--
-- Name: ma_cutover_stage_rows update_ma_cutover_stage_rows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_cutover_stage_rows_updated_at" BEFORE UPDATE ON "public"."ma_cutover_stage_rows" FOR EACH ROW EXECUTE FUNCTION "public"."update_ma_cutover_updated_at"();


--
-- Name: ma_firms update_ma_firms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_firms_updated_at" BEFORE UPDATE ON "public"."ma_firms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_offices update_ma_offices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_offices_updated_at" BEFORE UPDATE ON "public"."ma_offices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_source_contacts update_ma_source_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_source_contacts_updated_at" BEFORE UPDATE ON "public"."ma_source_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_source_networks update_ma_source_networks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_source_networks_updated_at" BEFORE UPDATE ON "public"."ma_source_networks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: ma_sources update_ma_sources_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_ma_sources_updated_at" BEFORE UPDATE ON "public"."ma_sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: opportunities update_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_opportunities_updated_at" BEFORE UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: opportunity_documents update_opportunity_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_opportunity_documents_updated_at" BEFORE UPDATE ON "public"."opportunity_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: opportunity_matches update_opportunity_matches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_opportunity_matches_updated_at" BEFORE UPDATE ON "public"."opportunity_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: repreneurs update_repreneurs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_repreneurs_updated_at" BEFORE UPDATE ON "public"."repreneurs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: geography_nodes validate_geography_node_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "validate_geography_node_parent" BEFORE INSERT OR UPDATE OF "node_level", "parent_id" ON "public"."geography_nodes" FOR EACH ROW EXECUTE FUNCTION "public"."validate_geography_node_parent"();


--
-- Name: opportunities wave_journey_guard_opportunity_lifecycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "wave_journey_guard_opportunity_lifecycle" BEFORE UPDATE OF "status" ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."wave_journey_guard_opportunity_lifecycle"();


--
-- Name: opportunity_nda_artifacts wave_journey_guard_repreneur_artifact_origin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "wave_journey_guard_repreneur_artifact_origin" BEFORE INSERT ON "public"."opportunity_nda_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."wave_journey_guard_repreneur_artifact_origin"();


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."account"
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE;


--
-- Name: activities activities_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: ai_generation_events ai_generation_events_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_generation_events"
    ADD CONSTRAINT "ai_generation_events_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "public"."ai_generation_runs"("generation_id") ON DELETE CASCADE;


--
-- Name: app_user_roles app_user_roles_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_user_roles"
    ADD CONSTRAINT "app_user_roles_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: email_logs email_logs_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: evaluation_criteria evaluation_criteria_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."evaluation_criteria"
    ADD CONSTRAINT "evaluation_criteria_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");


--
-- Name: external_pursuit_attachments external_pursuit_attachments_external_pursuit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_attachments"
    ADD CONSTRAINT "external_pursuit_attachments_external_pursuit_id_fkey" FOREIGN KEY ("external_pursuit_id") REFERENCES "public"."external_pursuits"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_audit_events external_pursuit_audit_events_external_pursuit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_audit_events"
    ADD CONSTRAINT "external_pursuit_audit_events_external_pursuit_id_fkey" FOREIGN KEY ("external_pursuit_id") REFERENCES "public"."external_pursuits"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_contacts external_pursuit_contacts_external_pursuit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_contacts"
    ADD CONSTRAINT "external_pursuit_contacts_external_pursuit_id_fkey" FOREIGN KEY ("external_pursuit_id") REFERENCES "public"."external_pursuits"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_deletion_tombstones external_pursuit_deletion_tombstones_owner_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_deletion_tombstones"
    ADD CONSTRAINT "external_pursuit_deletion_tombstones_owner_repreneur_id_fkey" FOREIGN KEY ("owner_repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_notes external_pursuit_notes_external_pursuit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_notes"
    ADD CONSTRAINT "external_pursuit_notes_external_pursuit_id_fkey" FOREIGN KEY ("external_pursuit_id") REFERENCES "public"."external_pursuits"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_opportunity_conversions external_pursuit_opportunity_conversio_external_pursuit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_opportunity_conversions"
    ADD CONSTRAINT "external_pursuit_opportunity_conversio_external_pursuit_id_fkey" FOREIGN KEY ("external_pursuit_id") REFERENCES "public"."external_pursuits"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_opportunity_conversions external_pursuit_opportunity_conversions_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_opportunity_conversions"
    ADD CONSTRAINT "external_pursuit_opportunity_conversions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuit_staff_notes external_pursuit_staff_notes_external_pursuit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuit_staff_notes"
    ADD CONSTRAINT "external_pursuit_staff_notes_external_pursuit_id_fkey" FOREIGN KEY ("external_pursuit_id") REFERENCES "public"."external_pursuits"("id") ON DELETE RESTRICT;


--
-- Name: external_pursuits external_pursuits_owner_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."external_pursuits"
    ADD CONSTRAINT "external_pursuits_owner_repreneur_id_fkey" FOREIGN KEY ("owner_repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE RESTRICT;


--
-- Name: geography_nodes geography_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."geography_nodes"
    ADD CONSTRAINT "geography_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."geography_nodes"("id") ON DELETE RESTRICT;


--
-- Name: intake_abandonment_tracking intake_abandonment_tracking_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."intake_abandonment_tracking"
    ADD CONSTRAINT "intake_abandonment_tracking_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: leadership_assessments leadership_assessments_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leadership_assessments"
    ADD CONSTRAINT "leadership_assessments_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: ma_contact_email_policy_events ma_contact_email_policy_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_email_policy_events"
    ADD CONSTRAINT "ma_contact_email_policy_events_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."ma_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_contact_email_policy_events ma_contact_email_policy_events_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_email_policy_events"
    ADD CONSTRAINT "ma_contact_email_policy_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: ma_contact_office_affiliations ma_contact_office_affiliations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_office_affiliations"
    ADD CONSTRAINT "ma_contact_office_affiliations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."ma_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_contact_office_affiliations ma_contact_office_affiliations_legacy_source_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_office_affiliations"
    ADD CONSTRAINT "ma_contact_office_affiliations_legacy_source_contact_id_fkey" FOREIGN KEY ("legacy_source_contact_id") REFERENCES "public"."ma_source_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_contact_office_affiliations ma_contact_office_affiliations_legacy_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_office_affiliations"
    ADD CONSTRAINT "ma_contact_office_affiliations_legacy_source_id_fkey" FOREIGN KEY ("legacy_source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: ma_contact_office_affiliations ma_contact_office_affiliations_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contact_office_affiliations"
    ADD CONSTRAINT "ma_contact_office_affiliations_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_contacts ma_contacts_legacy_source_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_contacts"
    ADD CONSTRAINT "ma_contacts_legacy_source_contact_id_fkey" FOREIGN KEY ("legacy_source_contact_id") REFERENCES "public"."ma_source_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_cutover_stage_issues ma_cutover_stage_issues_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_issues"
    ADD CONSTRAINT "ma_cutover_stage_issues_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ma_cutover_runs"("id") ON DELETE RESTRICT;


--
-- Name: ma_cutover_stage_issues ma_cutover_stage_issues_stage_row_same_run_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_issues"
    ADD CONSTRAINT "ma_cutover_stage_issues_stage_row_same_run_fkey" FOREIGN KEY ("run_id", "stage_row_id") REFERENCES "public"."ma_cutover_stage_rows"("run_id", "id") ON DELETE CASCADE;


--
-- Name: ma_cutover_stage_rows ma_cutover_stage_rows_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_cutover_stage_rows"
    ADD CONSTRAINT "ma_cutover_stage_rows_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ma_cutover_runs"("id") ON DELETE RESTRICT;


--
-- Name: ma_firms ma_firms_legacy_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_firms"
    ADD CONSTRAINT "ma_firms_legacy_source_id_fkey" FOREIGN KEY ("legacy_source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: ma_interaction_delivery_events ma_interaction_delivery_events_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interaction_delivery_events"
    ADD CONSTRAINT "ma_interaction_delivery_events_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."ma_interactions"("id") ON DELETE RESTRICT;


--
-- Name: ma_interaction_owner_verification_events ma_interaction_owner_verification_events_interaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interaction_owner_verification_events"
    ADD CONSTRAINT "ma_interaction_owner_verification_events_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."ma_interactions"("id") ON DELETE RESTRICT;


--
-- Name: ma_interactions ma_interactions_affiliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interactions"
    ADD CONSTRAINT "ma_interactions_affiliation_id_fkey" FOREIGN KEY ("affiliation_id") REFERENCES "public"."ma_contact_office_affiliations"("id") ON DELETE RESTRICT;


--
-- Name: ma_interactions ma_interactions_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interactions"
    ADD CONSTRAINT "ma_interactions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_interactions ma_interactions_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_interactions"
    ADD CONSTRAINT "ma_interactions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: ma_offices ma_offices_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_offices"
    ADD CONSTRAINT "ma_offices_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."ma_firms"("id") ON DELETE RESTRICT;


--
-- Name: ma_offices ma_offices_legacy_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_offices"
    ADD CONSTRAINT "ma_offices_legacy_source_id_fkey" FOREIGN KEY ("legacy_source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: ma_opportunity_date_correction_events ma_opportunity_date_correction_events_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_opportunity_date_correction_events"
    ADD CONSTRAINT "ma_opportunity_date_correction_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id");


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_affiliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_affiliation_id_fkey" FOREIGN KEY ("affiliation_id") REFERENCES "public"."ma_contact_office_affiliations"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."ma_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."ma_firms"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_contexts ma_provisional_source_contexts_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_contexts"
    ADD CONSTRAINT "ma_provisional_source_contexts_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_review_events ma_provisional_source_review_ev_resulting_source_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_review_events"
    ADD CONSTRAINT "ma_provisional_source_review_ev_resulting_source_office_id_fkey" FOREIGN KEY ("resulting_source_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_review_events ma_provisional_source_review_events_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_review_events"
    ADD CONSTRAINT "ma_provisional_source_review_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_review_events ma_provisional_source_review_events_prior_source_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_review_events"
    ADD CONSTRAINT "ma_provisional_source_review_events_prior_source_office_id_fkey" FOREIGN KEY ("prior_source_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_review_events ma_provisional_source_review_events_provisional_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_review_events"
    ADD CONSTRAINT "ma_provisional_source_review_events_provisional_office_id_fkey" FOREIGN KEY ("provisional_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_provisional_source_review_events ma_provisional_source_review_events_related_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_provisional_source_review_events"
    ADD CONSTRAINT "ma_provisional_source_review_events_related_assignment_id_fkey" FOREIGN KEY ("related_assignment_id") REFERENCES "public"."ma_provisional_source_review_events"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_contact_moves ma_source_contact_moves_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contact_moves"
    ADD CONSTRAINT "ma_source_contact_moves_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."ma_source_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_contact_moves ma_source_contact_moves_new_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contact_moves"
    ADD CONSTRAINT "ma_source_contact_moves_new_source_id_fkey" FOREIGN KEY ("new_source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_contact_moves ma_source_contact_moves_old_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contact_moves"
    ADD CONSTRAINT "ma_source_contact_moves_old_source_id_fkey" FOREIGN KEY ("old_source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_contacts ma_source_contacts_canonical_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contacts"
    ADD CONSTRAINT "ma_source_contacts_canonical_contact_id_fkey" FOREIGN KEY ("canonical_contact_id") REFERENCES "public"."ma_contacts"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_contacts ma_source_contacts_office_affiliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contacts"
    ADD CONSTRAINT "ma_source_contacts_office_affiliation_id_fkey" FOREIGN KEY ("office_affiliation_id") REFERENCES "public"."ma_contact_office_affiliations"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_contacts ma_source_contacts_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_contacts"
    ADD CONSTRAINT "ma_source_contacts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_email_send_reservations ma_source_email_send_reservations_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_email_send_reservations"
    ADD CONSTRAINT "ma_source_email_send_reservations_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_email_send_reservations ma_source_email_send_reservations_source_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_email_send_reservations"
    ADD CONSTRAINT "ma_source_email_send_reservations_source_office_id_fkey" FOREIGN KEY ("source_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_source_interactions ma_source_interactions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_interactions"
    ADD CONSTRAINT "ma_source_interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."ma_source_contacts"("id") ON DELETE SET NULL;


--
-- Name: ma_source_interactions ma_source_interactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_interactions"
    ADD CONSTRAINT "ma_source_interactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ma_source_interactions ma_source_interactions_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_interactions"
    ADD CONSTRAINT "ma_source_interactions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;


--
-- Name: ma_source_interactions ma_source_interactions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_source_interactions"
    ADD CONSTRAINT "ma_source_interactions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ma_sources"("id") ON DELETE SET NULL;


--
-- Name: ma_sources ma_sources_default_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_sources"
    ADD CONSTRAINT "ma_sources_default_office_id_fkey" FOREIGN KEY ("default_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: ma_sources ma_sources_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_sources"
    ADD CONSTRAINT "ma_sources_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."ma_firms"("id") ON DELETE RESTRICT;


--
-- Name: ma_sources ma_sources_network_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_sources"
    ADD CONSTRAINT "ma_sources_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."ma_source_networks"("id") ON DELETE SET NULL;


--
-- Name: ma_w039_geography_adoption_evidence ma_w039_geography_adoption_evidence_geography_node_after_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_evidence"
    ADD CONSTRAINT "ma_w039_geography_adoption_evidence_geography_node_after_fkey" FOREIGN KEY ("geography_node_after") REFERENCES "public"."geography_nodes"("id") ON DELETE RESTRICT;


--
-- Name: ma_w039_geography_adoption_evidence ma_w039_geography_adoption_evidence_geography_node_before_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_evidence"
    ADD CONSTRAINT "ma_w039_geography_adoption_evidence_geography_node_before_fkey" FOREIGN KEY ("geography_node_before") REFERENCES "public"."geography_nodes"("id") ON DELETE RESTRICT;


--
-- Name: ma_w039_geography_adoption_evidence ma_w039_geography_adoption_evidence_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_evidence"
    ADD CONSTRAINT "ma_w039_geography_adoption_evidence_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: ma_w039_geography_adoption_evidence ma_w039_geography_adoption_evidence_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ma_w039_geography_adoption_evidence"
    ADD CONSTRAINT "ma_w039_geography_adoption_evidence_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ma_w039_geography_adoption_runs"("id") ON DELETE RESTRICT;


--
-- Name: notes notes_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: offer_milestones offer_milestones_repreneur_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offer_milestones"
    ADD CONSTRAINT "offer_milestones_repreneur_offer_id_fkey" FOREIGN KEY ("repreneur_offer_id") REFERENCES "public"."repreneur_offers"("id") ON DELETE CASCADE;


--
-- Name: opportunities opportunities_geography_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_geography_node_id_fkey" FOREIGN KEY ("geography_node_id") REFERENCES "public"."geography_nodes"("id") ON DELETE RESTRICT;


--
-- Name: opportunities opportunities_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ma_sources"("id") ON DELETE SET NULL;


--
-- Name: opportunities opportunities_source_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_source_office_id_fkey" FOREIGN KEY ("source_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_closure_history opportunity_closure_history_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_closure_history"
    ADD CONSTRAINT "opportunity_closure_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_documents opportunity_documents_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_documents"
    ADD CONSTRAINT "opportunity_documents_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;


--
-- Name: opportunity_ma_contacts opportunity_ma_contacts_affiliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_ma_contacts"
    ADD CONSTRAINT "opportunity_ma_contacts_affiliation_id_fkey" FOREIGN KEY ("affiliation_id") REFERENCES "public"."ma_contact_office_affiliations"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_ma_contacts opportunity_ma_contacts_legacy_source_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_ma_contacts"
    ADD CONSTRAINT "opportunity_ma_contacts_legacy_source_contact_id_fkey" FOREIGN KEY ("legacy_source_contact_id") REFERENCES "public"."ma_source_contacts"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_ma_contacts opportunity_ma_contacts_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_ma_contacts"
    ADD CONSTRAINT "opportunity_ma_contacts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_matches opportunity_matches_nda_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_nda_document_id_fkey" FOREIGN KEY ("nda_document_id") REFERENCES "public"."opportunity_documents"("id") ON DELETE SET NULL;


--
-- Name: opportunity_matches opportunity_matches_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;


--
-- Name: opportunity_matches opportunity_matches_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_matches"
    ADD CONSTRAINT "opportunity_matches_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: opportunity_memo_notifications opportunity_memo_notifications_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_memo_notifications"
    ADD CONSTRAINT "opportunity_memo_notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."opportunity_matches"("id") ON DELETE CASCADE;


--
-- Name: opportunity_memo_notifications opportunity_memo_notifications_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_memo_notifications"
    ADD CONSTRAINT "opportunity_memo_notifications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;


--
-- Name: opportunity_memo_notifications opportunity_memo_notifications_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_memo_notifications"
    ADD CONSTRAINT "opportunity_memo_notifications_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."opportunity_documents"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."opportunity_matches"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_supersedes_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_nda_artifacts"
    ADD CONSTRAINT "opportunity_nda_artifacts_supersedes_artifact_id_fkey" FOREIGN KEY ("supersedes_artifact_id") REFERENCES "public"."opportunity_nda_artifacts"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confident_information_memo_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confident_information_memo_document_id_fkey" FOREIGN KEY ("information_memo_document_id") REFERENCES "public"."opportunity_documents"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_cycle_started_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_cycle_started_evidence_id_fkey" FOREIGN KEY ("cycle_started_evidence_id") REFERENCES "public"."opportunity_pursuit_evidence"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_gran_dispatch_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_gran_dispatch_evidence_id_fkey" FOREIGN KEY ("dispatch_evidence_id") REFERENCES "public"."opportunity_pursuit_evidence"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_gate_2_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_gate_2_evidence_id_fkey" FOREIGN KEY ("gate_2_evidence_id") REFERENCES "public"."opportunity_pursuit_evidence"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."opportunity_matches"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_source_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_source_firm_id_fkey" FOREIGN KEY ("source_firm_id") REFERENCES "public"."ma_firms"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_confidential_grants opportunity_pursuit_confidential_grants_source_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_confidential_grants"
    ADD CONSTRAINT "opportunity_pursuit_confidential_grants_source_office_id_fkey" FOREIGN KEY ("source_office_id") REFERENCES "public"."ma_offices"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_events opportunity_pursuit_events_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_events"
    ADD CONSTRAINT "opportunity_pursuit_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."opportunity_matches"("id") ON DELETE CASCADE;


--
-- Name: opportunity_pursuit_events opportunity_pursuit_events_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_events"
    ADD CONSTRAINT "opportunity_pursuit_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;


--
-- Name: opportunity_pursuit_events opportunity_pursuit_events_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_events"
    ADD CONSTRAINT "opportunity_pursuit_events_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."opportunity_documents"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."opportunity_matches"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_nda_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_nda_artifact_id_fkey" FOREIGN KEY ("nda_artifact_id") REFERENCES "public"."opportunity_nda_artifacts"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_pursuit_evidence opportunity_pursuit_evidence_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_pursuit_evidence"
    ADD CONSTRAINT "opportunity_pursuit_evidence_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_source_contacts opportunity_source_contacts_canonical_opportunity_contact__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_source_contacts"
    ADD CONSTRAINT "opportunity_source_contacts_canonical_opportunity_contact__fkey" FOREIGN KEY ("canonical_opportunity_contact_id") REFERENCES "public"."opportunity_ma_contacts"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_source_contacts opportunity_source_contacts_contact_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_source_contacts"
    ADD CONSTRAINT "opportunity_source_contacts_contact_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."ma_source_contacts"("id") ON DELETE RESTRICT;


--
-- Name: opportunity_source_contacts opportunity_source_contacts_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_source_contacts"
    ADD CONSTRAINT "opportunity_source_contacts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;


--
-- Name: opportunity_source_contacts opportunity_source_contacts_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."opportunity_source_contacts"
    ADD CONSTRAINT "opportunity_source_contacts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."ma_sources"("id") ON DELETE RESTRICT;


--
-- Name: pdr_feedback pdr_feedback_work_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_feedback"
    ADD CONSTRAINT "pdr_feedback_work_card_id_fkey" FOREIGN KEY ("work_card_id") REFERENCES "public"."pdr_work_cards"("id") ON DELETE CASCADE;


--
-- Name: pdr_milestones pdr_milestones_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_milestones"
    ADD CONSTRAINT "pdr_milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."pdr_goals"("id") ON DELETE SET NULL;


--
-- Name: pdr_proposals pdr_proposals_matched_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_proposals"
    ADD CONSTRAINT "pdr_proposals_matched_proposal_id_fkey" FOREIGN KEY ("matched_proposal_id") REFERENCES "public"."pdr_proposals"("id") ON DELETE SET NULL;


--
-- Name: pdr_proposals pdr_proposals_matched_work_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_proposals"
    ADD CONSTRAINT "pdr_proposals_matched_work_card_id_fkey" FOREIGN KEY ("matched_work_card_id") REFERENCES "public"."pdr_work_cards"("id") ON DELETE SET NULL;


--
-- Name: pdr_proposals pdr_proposals_suggested_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_proposals"
    ADD CONSTRAINT "pdr_proposals_suggested_bundle_id_fkey" FOREIGN KEY ("suggested_bundle_id") REFERENCES "public"."pdr_requests"("id") ON DELETE SET NULL;


--
-- Name: pdr_proposals pdr_proposals_suggested_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_proposals"
    ADD CONSTRAINT "pdr_proposals_suggested_goal_id_fkey" FOREIGN KEY ("suggested_goal_id") REFERENCES "public"."pdr_goals"("id") ON DELETE SET NULL;


--
-- Name: pdr_proposals pdr_proposals_suggested_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_proposals"
    ADD CONSTRAINT "pdr_proposals_suggested_milestone_id_fkey" FOREIGN KEY ("suggested_milestone_id") REFERENCES "public"."pdr_milestones"("id") ON DELETE SET NULL;


--
-- Name: pdr_requests pdr_requests_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_requests"
    ADD CONSTRAINT "pdr_requests_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."pdr_goals"("id") ON DELETE SET NULL;


--
-- Name: pdr_requests pdr_requests_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_requests"
    ADD CONSTRAINT "pdr_requests_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."pdr_milestones"("id") ON DELETE SET NULL;


--
-- Name: pdr_work_cards pdr_work_cards_replaced_by_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_work_cards"
    ADD CONSTRAINT "pdr_work_cards_replaced_by_card_id_fkey" FOREIGN KEY ("replaced_by_card_id") REFERENCES "public"."pdr_work_cards"("id") ON DELETE SET NULL;


--
-- Name: pdr_work_cards pdr_work_cards_replaces_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_work_cards"
    ADD CONSTRAINT "pdr_work_cards_replaces_card_id_fkey" FOREIGN KEY ("replaces_card_id") REFERENCES "public"."pdr_work_cards"("id") ON DELETE SET NULL;


--
-- Name: pdr_work_cards pdr_work_cards_source_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_work_cards"
    ADD CONSTRAINT "pdr_work_cards_source_proposal_id_fkey" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."pdr_proposals"("id") ON DELETE SET NULL;


--
-- Name: pdr_work_cards pdr_work_cards_strategic_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pdr_work_cards"
    ADD CONSTRAINT "pdr_work_cards_strategic_item_id_fkey" FOREIGN KEY ("strategic_item_id") REFERENCES "public"."pdr_requests"("id") ON DELETE CASCADE;


--
-- Name: repreneur_geography_targets repreneur_geography_targets_geography_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneur_geography_targets"
    ADD CONSTRAINT "repreneur_geography_targets_geography_node_id_fkey" FOREIGN KEY ("geography_node_id") REFERENCES "public"."geography_nodes"("id") ON DELETE RESTRICT;


--
-- Name: repreneur_geography_targets repreneur_geography_targets_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneur_geography_targets"
    ADD CONSTRAINT "repreneur_geography_targets_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: repreneur_offers repreneur_offers_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneur_offers"
    ADD CONSTRAINT "repreneur_offers_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE CASCADE;


--
-- Name: repreneur_offers repreneur_offers_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneur_offers"
    ADD CONSTRAINT "repreneur_offers_repreneur_id_fkey" FOREIGN KEY ("repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE CASCADE;


--
-- Name: repreneurs repreneurs_leadership_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneurs"
    ADD CONSTRAINT "repreneurs_leadership_assessment_id_fkey" FOREIGN KEY ("leadership_assessment_id") REFERENCES "public"."leadership_assessments"("id");


--
-- Name: repreneurs repreneurs_tier2_rated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."repreneurs"
    ADD CONSTRAINT "repreneurs_tier2_rated_by_fkey" FOREIGN KEY ("tier2_rated_by") REFERENCES "auth"."users"("id");


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE;


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");


--
-- Name: waitlist waitlist_promoted_repreneur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_promoted_repreneur_id_fkey" FOREIGN KEY ("promoted_repreneur_id") REFERENCES "public"."repreneurs"("id") ON DELETE SET NULL;


--
-- Name: email_daily_counts Anyone can view daily counts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view daily counts" ON "public"."email_daily_counts" FOR SELECT USING (true);


--
-- Name: notes Authenticated users can view all notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all notes" ON "public"."notes" FOR SELECT TO "authenticated" USING (true);


--
-- Name: offers Authenticated users can view all offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all offers" ON "public"."offers" FOR SELECT TO "authenticated" USING (true);


--
-- Name: repreneur_offers Authenticated users can view all repreneur offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all repreneur offers" ON "public"."repreneur_offers" FOR SELECT TO "authenticated" USING (true);


--
-- Name: tasks Authenticated users can view all tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (true);


--
-- Name: clipboard Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON "public"."clipboard" FOR SELECT USING (true);


--
-- Name: email_templates Users can update email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update email templates" ON "public"."email_templates" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));


--
-- Name: evaluation_criteria Users can update evaluation criteria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update evaluation criteria" ON "public"."evaluation_criteria" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));


--
-- Name: intake_abandonment_tracking Users can view abandonment tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view abandonment tracking" ON "public"."intake_abandonment_tracking" FOR SELECT USING (true);


--
-- Name: email_logs Users can view email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view email logs" ON "public"."email_logs" FOR SELECT USING (("auth"."uid"() IS NOT NULL));


--
-- Name: email_templates Users can view email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view email templates" ON "public"."email_templates" FOR SELECT USING (("auth"."uid"() IS NOT NULL));


--
-- Name: evaluation_criteria Users can view evaluation criteria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view evaluation criteria" ON "public"."evaluation_criteria" FOR SELECT USING (("auth"."uid"() IS NOT NULL));


--
-- Name: account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."account" ENABLE ROW LEVEL SECURITY;

--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_generation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_generation_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_generation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_generation_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: app_user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: clipboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."clipboard" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_daily_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."email_daily_counts" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluation_criteria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."evaluation_criteria" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_attachments" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_audit_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_contacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_deletion_tombstones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_deletion_tombstones" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_opportunity_conversions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_opportunity_conversions" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuit_staff_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuit_staff_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: external_pursuits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."external_pursuits" ENABLE ROW LEVEL SECURITY;

--
-- Name: geography_nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."geography_nodes" ENABLE ROW LEVEL SECURITY;

--
-- Name: intake_abandonment_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."intake_abandonment_tracking" ENABLE ROW LEVEL SECURITY;

--
-- Name: leadership_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leadership_assessments" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_contact_email_policy_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_contact_email_policy_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_contact_office_affiliations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_contact_office_affiliations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_contacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_cutover_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_cutover_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_cutover_stage_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_cutover_stage_issues" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_cutover_stage_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_cutover_stage_rows" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_firms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_firms" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_interaction_delivery_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_interaction_delivery_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_interaction_legacy_migration_manifest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_interaction_legacy_migration_manifest" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_interaction_owner_verification_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_interaction_owner_verification_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_interactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_offices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_offices" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_opportunity_date_correction_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_opportunity_date_correction_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_provisional_source_contexts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_provisional_source_contexts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_provisional_source_review_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_provisional_source_review_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_source_contact_moves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_source_contact_moves" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_source_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_source_contacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_source_email_send_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_source_email_send_reservations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_source_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_source_interactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_source_networks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_source_networks" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_sources" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_w039_geography_adoption_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_w039_geography_adoption_evidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_w039_geography_adoption_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_w039_geography_adoption_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ma_w039_release_control; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ma_w039_release_control" ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_delivery_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notification_delivery_claims" ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."offer_milestones" ENABLE ROW LEVEL SECURITY;

--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_closure_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_closure_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_ma_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_ma_contacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_mandate_reference_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_mandate_reference_counters" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_matches" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_memo_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_memo_notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_nda_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_nda_artifacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_nda_artifacts opportunity_nda_artifacts_service_role_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "opportunity_nda_artifacts_service_role_read" ON "public"."opportunity_nda_artifacts" FOR SELECT TO "service_role" USING (true);


--
-- Name: opportunity_pursuit_confidential_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_pursuit_confidential_grants" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_pursuit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_pursuit_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_pursuit_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_pursuit_evidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunity_source_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."opportunity_source_contacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: pdr_feedback pdr feedback is publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pdr feedback is publicly readable" ON "public"."pdr_feedback" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: pdr_goals pdr goals are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pdr goals are publicly readable" ON "public"."pdr_goals" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: pdr_milestones pdr milestones are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pdr milestones are publicly readable" ON "public"."pdr_milestones" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: pdr_proposals pdr proposals are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pdr proposals are publicly readable" ON "public"."pdr_proposals" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: pdr_requests pdr requests are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pdr requests are publicly readable" ON "public"."pdr_requests" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: pdr_work_cards pdr work cards are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pdr work cards are publicly readable" ON "public"."pdr_work_cards" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: pdr_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pdr_feedback" ENABLE ROW LEVEL SECURITY;

--
-- Name: pdr_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pdr_goals" ENABLE ROW LEVEL SECURITY;

--
-- Name: pdr_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pdr_milestones" ENABLE ROW LEVEL SECURITY;

--
-- Name: pdr_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pdr_proposals" ENABLE ROW LEVEL SECURITY;

--
-- Name: pdr_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pdr_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: pdr_work_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pdr_work_cards" ENABLE ROW LEVEL SECURITY;

--
-- Name: rateLimit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rateLimit" ENABLE ROW LEVEL SECURITY;

--
-- Name: repreneur_geography_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."repreneur_geography_targets" ENABLE ROW LEVEL SECURITY;

--
-- Name: repreneur_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."repreneur_offers" ENABLE ROW LEVEL SECURITY;

--
-- Name: repreneurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."repreneurs" ENABLE ROW LEVEL SECURITY;

--
-- Name: sector_taxonomy_legacy_20260720; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sector_taxonomy_legacy_20260720" ENABLE ROW LEVEL SECURITY;

--
-- Name: session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."session" ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: user; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;

--
-- Name: verification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."verification" ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;

--
-- Name: wave_journey_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."wave_journey_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: wavy_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."wavy_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: TYPE "lifecycle_status"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE "public"."lifecycle_status" TO "authenticated";


--
-- Name: TYPE "ma_contact_email_purpose"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."ma_contact_email_purpose" FROM PUBLIC;
GRANT ALL ON TYPE "public"."ma_contact_email_purpose" TO "service_role";


--
-- Name: TYPE "ma_source_type"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."ma_source_type" FROM PUBLIC;
GRANT ALL ON TYPE "public"."ma_source_type" TO "service_role";


--
-- Name: TYPE "opportunity_closure_reason"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_closure_reason" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_closure_reason" TO "service_role";


--
-- Name: TYPE "opportunity_document_type"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_document_type" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_document_type" TO "service_role";


--
-- Name: TYPE "opportunity_document_visibility"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_document_visibility" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_document_visibility" TO "service_role";


--
-- Name: TYPE "opportunity_match_recommendation"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_match_recommendation" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_match_recommendation" TO "service_role";


--
-- Name: TYPE "opportunity_match_status"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_match_status" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_match_status" TO "service_role";


--
-- Name: TYPE "opportunity_nda_artifact_role"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_nda_artifact_role" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_nda_artifact_role" TO "service_role";


--
-- Name: TYPE "opportunity_nda_status"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_nda_status" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_nda_status" TO "service_role";


--
-- Name: TYPE "opportunity_pursuit_stage"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_pursuit_stage" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_pursuit_stage" TO "service_role";


--
-- Name: TYPE "opportunity_status"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_status" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_status" TO "service_role";


--
-- Name: TYPE "opportunity_visibility"; Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON TYPE "public"."opportunity_visibility" FROM PUBLIC;
GRANT ALL ON TYPE "public"."opportunity_visibility" TO "service_role";


--
-- Name: FUNCTION "activate_ma_cutover_run"("p_run_id" "uuid", "p_approval_digest" "text", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."activate_ma_cutover_run"("p_run_id" "uuid", "p_approval_digest" "text", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_ma_cutover_run"("p_run_id" "uuid", "p_approval_digest" "text", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "activate_w039_geography_mandates"("p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."activate_w039_geography_mandates"("p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_w039_geography_mandates"("p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "apply_w039_geography_adoption"("p_source_hash" "text", "p_actor" "text", "p_payload" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."apply_w039_geography_adoption"("p_source_hash" "text", "p_actor" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_w039_geography_adoption"("p_source_hash" "text", "p_actor" "text", "p_payload" "jsonb") TO "service_role";


--
-- Name: TABLE "external_pursuits"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuits" TO "service_role";


--
-- Name: FUNCTION "assert_external_pursuit_access"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_staff_only" boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_external_pursuit_access"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_staff_only" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_external_pursuit_access"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_staff_only" boolean) TO "service_role";


--
-- Name: FUNCTION "assert_external_pursuit_not_converted"("p_dossier_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_external_pursuit_not_converted"("p_dossier_id" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "assert_ma_firm_has_active_office"("p_firm_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_ma_firm_has_active_office"("p_firm_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_ma_firm_has_active_office"("p_firm_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "assert_ma_provisional_source_context_integrity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_ma_provisional_source_context_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_ma_provisional_source_context_integrity"() TO "service_role";


--
-- Name: FUNCTION "assert_ma_provisional_source_review_state"("p_opportunity_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_ma_provisional_source_review_state"("p_opportunity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_ma_provisional_source_review_state"("p_opportunity_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "assert_opportunity_nda_artifact_integrity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_opportunity_nda_artifact_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_opportunity_nda_artifact_integrity"() TO "service_role";


--
-- Name: FUNCTION "assert_opportunity_office_context"("p_opportunity_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_opportunity_office_context"("p_opportunity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_opportunity_office_context"("p_opportunity_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "assert_opportunity_pursuit_evidence_integrity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assert_opportunity_pursuit_evidence_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_opportunity_pursuit_evidence_integrity"() TO "service_role";


--
-- Name: TABLE "opportunities"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."opportunities" TO "service_role";


--
-- Name: FUNCTION "assign_acme_provisional_source"("p_opportunity_id" "uuid", "p_actor" "text", "p_reason" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assign_acme_provisional_source"("p_opportunity_id" "uuid", "p_actor" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_acme_provisional_source"("p_opportunity_id" "uuid", "p_actor" "text", "p_reason" "text") TO "service_role";


--
-- Name: FUNCTION "assign_repreneur_offer"("p_repreneur_id" "uuid", "p_offer_id" "uuid", "p_created_by" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."assign_repreneur_offer"("p_repreneur_id" "uuid", "p_offer_id" "uuid", "p_created_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_repreneur_offer"("p_repreneur_id" "uuid", "p_offer_id" "uuid", "p_created_by" "text") TO "service_role";


--
-- Name: FUNCTION "authorize_ma_contact_email_send"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose", "p_actor" "text", "p_operation_key" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."authorize_ma_contact_email_send"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose", "p_actor" "text", "p_operation_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authorize_ma_contact_email_send"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose", "p_actor" "text", "p_operation_key" "uuid") TO "service_role";


--
-- Name: FUNCTION "begin_ma_interaction_email_send"("p_opportunity_id" "uuid", "p_office_id" "uuid", "p_affiliation_id" "uuid", "p_actor" "text", "p_template_key" "text", "p_recipient_email" "text", "p_title" "text", "p_body_markdown" "text", "p_client_operation_key" "uuid", "p_provider_request_fingerprint" "text", "p_reservation_token" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."begin_ma_interaction_email_send"("p_opportunity_id" "uuid", "p_office_id" "uuid", "p_affiliation_id" "uuid", "p_actor" "text", "p_template_key" "text", "p_recipient_email" "text", "p_title" "text", "p_body_markdown" "text", "p_client_operation_key" "uuid", "p_provider_request_fingerprint" "text", "p_reservation_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_ma_interaction_email_send"("p_opportunity_id" "uuid", "p_office_id" "uuid", "p_affiliation_id" "uuid", "p_actor" "text", "p_template_key" "text", "p_recipient_email" "text", "p_title" "text", "p_body_markdown" "text", "p_client_operation_key" "uuid", "p_provider_request_fingerprint" "text", "p_reservation_token" "uuid") TO "service_role";


--
-- Name: FUNCTION "capture_opportunity_ma_contact_snapshot"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."capture_opportunity_ma_contact_snapshot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capture_opportunity_ma_contact_snapshot"() TO "service_role";


--
-- Name: FUNCTION "capture_opportunity_source_contact_snapshot"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."capture_opportunity_source_contact_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_opportunity_source_contact_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_opportunity_source_contact_snapshot"() TO "service_role";


--
-- Name: FUNCTION "claim_notification_delivery"("p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."claim_notification_delivery"("p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_notification_delivery"("p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "claim_opportunity_memo_notification"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_attempted_at" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."claim_opportunity_memo_notification"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_attempted_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_opportunity_memo_notification"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_attempted_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "clear_external_pursuit_attachment_records_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."clear_external_pursuit_attachment_records_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_external_pursuit_attachment_records_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "close_opportunity_with_reason"("p_opportunity_id" "uuid", "p_reason" "public"."opportunity_closure_reason", "p_closed_by" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."close_opportunity_with_reason"("p_opportunity_id" "uuid", "p_reason" "public"."opportunity_closure_reason", "p_closed_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_opportunity_with_reason"("p_opportunity_id" "uuid", "p_reason" "public"."opportunity_closure_reason", "p_closed_by" "text") TO "service_role";


--
-- Name: FUNCTION "complete_notification_delivery"("p_idempotency_key" "text", "p_lease_token" "text", "p_succeeded" boolean, "p_provider_message_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."complete_notification_delivery"("p_idempotency_key" "text", "p_lease_token" "text", "p_succeeded" boolean, "p_provider_message_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_notification_delivery"("p_idempotency_key" "text", "p_lease_token" "text", "p_succeeded" boolean, "p_provider_message_id" "text") TO "service_role";


--
-- Name: FUNCTION "complete_opportunity_memo_notification"("p_match_id" "uuid", "p_sent_at" timestamp with time zone, "p_provider_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."complete_opportunity_memo_notification"("p_match_id" "uuid", "p_sent_at" timestamp with time zone, "p_provider_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_opportunity_memo_notification"("p_match_id" "uuid", "p_sent_at" timestamp with time zone, "p_provider_id" "text") TO "service_role";


--
-- Name: FUNCTION "compute_journey_stage"("milestone_count" integer, "persona" "text"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."compute_journey_stage"("milestone_count" integer, "persona" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_journey_stage"("milestone_count" integer, "persona" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_journey_stage"("milestone_count" integer, "persona" "text") TO "service_role";


--
-- Name: FUNCTION "compute_ma_cutover_approval_digest"("p_run_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."compute_ma_cutover_approval_digest"("p_run_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_ma_cutover_approval_digest"("p_run_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "confirm_external_pursuit_current"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."confirm_external_pursuit_current"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_external_pursuit_current"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "convert_external_pursuit_to_opportunity"("p_dossier_id" "uuid", "p_public_title" "text", "p_geography_node_id" "uuid", "p_source_office_id" "uuid", "p_primary_affiliation_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."convert_external_pursuit_to_opportunity"("p_dossier_id" "uuid", "p_public_title" "text", "p_geography_node_id" "uuid", "p_source_office_id" "uuid", "p_primary_affiliation_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convert_external_pursuit_to_opportunity"("p_dossier_id" "uuid", "p_public_title" "text", "p_geography_node_id" "uuid", "p_source_office_id" "uuid", "p_primary_affiliation_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "create_external_pursuit"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_external_pursuit"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_external_pursuit"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "create_external_pursuit_v2"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_external_url" "text", "p_target_company" "text", "p_source_channel" "text", "p_revenue_meur" numeric, "p_ebitda_keur" numeric, "p_headcount" integer, "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_external_pursuit_v2"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_external_url" "text", "p_target_company" "text", "p_source_channel" "text", "p_revenue_meur" numeric, "p_ebitda_keur" numeric, "p_headcount" integer, "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_external_pursuit_v2"("p_owner_repreneur_id" "uuid", "p_title" "text", "p_stage" "text", "p_availability" "text", "p_due_at" "date", "p_shared_notes" "text", "p_staff_internal_notes" "text", "p_external_url" "text", "p_target_company" "text", "p_source_channel" "text", "p_revenue_meur" numeric, "p_ebitda_keur" numeric, "p_headcount" integer, "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "create_ma_firm_with_default_office"("p_firm_name" "text", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_office_name" "text", "p_is_synthetic_default" boolean, "p_contact_email" "text", "p_contact_phone" "text", "p_contact_job_title" "text", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_ma_firm_with_default_office"("p_firm_name" "text", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_office_name" "text", "p_is_synthetic_default" boolean, "p_contact_email" "text", "p_contact_phone" "text", "p_contact_job_title" "text", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_ma_firm_with_default_office"("p_firm_name" "text", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_office_name" "text", "p_is_synthetic_default" boolean, "p_contact_email" "text", "p_contact_phone" "text", "p_contact_job_title" "text", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "create_ma_office_for_existing_firm"("p_firm_id" "uuid", "p_office_name" "text", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_ma_office_for_existing_firm"("p_firm_id" "uuid", "p_office_name" "text", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_ma_office_for_existing_firm"("p_firm_id" "uuid", "p_office_name" "text", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "create_ma_relationship_interaction"("p_office_id" "uuid", "p_affiliation_id" "uuid", "p_opportunity_id" "uuid", "p_channel" "text", "p_direction" "text", "p_occurred_at" timestamp with time zone, "p_title" "text", "p_summary" "text", "p_outcome" "text", "p_next_action" "text", "p_next_action_due_at" timestamp with time zone, "p_recipient_email_snapshot" "text", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_ma_relationship_interaction"("p_office_id" "uuid", "p_affiliation_id" "uuid", "p_opportunity_id" "uuid", "p_channel" "text", "p_direction" "text", "p_occurred_at" timestamp with time zone, "p_title" "text", "p_summary" "text", "p_outcome" "text", "p_next_action" "text", "p_next_action_due_at" timestamp with time zone, "p_recipient_email_snapshot" "text", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_ma_relationship_interaction"("p_office_id" "uuid", "p_affiliation_id" "uuid", "p_opportunity_id" "uuid", "p_channel" "text", "p_direction" "text", "p_occurred_at" timestamp with time zone, "p_title" "text", "p_summary" "text", "p_outcome" "text", "p_next_action" "text", "p_next_action_due_at" timestamp with time zone, "p_recipient_email_snapshot" "text", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "create_opportunity_with_office_context"("p_reference" "text", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_opportunity_with_office_context"("p_reference" "text", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_opportunity_with_office_context"("p_reference" "text", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb") TO "service_role";


--
-- Name: FUNCTION "create_opportunity_with_office_context_legacy"("p_reference" "text", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_opportunity_with_office_context_legacy"("p_reference" "text", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb") FROM PUBLIC;


--
-- Name: FUNCTION "create_or_affiliate_ma_contact"("p_office_id" "uuid", "p_existing_contact_id" "uuid", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_contact_job_title" "text", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."create_or_affiliate_ma_contact"("p_office_id" "uuid", "p_existing_contact_id" "uuid", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_contact_job_title" "text", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_or_affiliate_ma_contact"("p_office_id" "uuid", "p_existing_contact_id" "uuid", "p_contact_first_name" "text", "p_contact_last_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_contact_job_title" "text", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "delete_external_pursuit_attachment_record"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."delete_external_pursuit_attachment_record"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_external_pursuit_attachment_record"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "enforce_ma_firm_active_office"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enforce_ma_firm_active_office"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_ma_firm_active_office"() TO "service_role";


--
-- Name: FUNCTION "enforce_ma_interaction_office_context"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enforce_ma_interaction_office_context"() FROM PUBLIC;


--
-- Name: FUNCTION "enforce_ma_provisional_source_review_on_event"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enforce_ma_provisional_source_review_on_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_ma_provisional_source_review_on_event"() TO "service_role";


--
-- Name: FUNCTION "enforce_ma_provisional_source_review_on_opportunity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enforce_ma_provisional_source_review_on_opportunity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_ma_provisional_source_review_on_opportunity"() TO "service_role";


--
-- Name: FUNCTION "enforce_opportunity_office_context"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."enforce_opportunity_office_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_opportunity_office_context"() TO "service_role";


--
-- Name: FUNCTION "enforce_opportunity_source_contact_integrity"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."enforce_opportunity_source_contact_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_opportunity_source_contact_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_opportunity_source_contact_integrity"() TO "service_role";


--
-- Name: FUNCTION "express_locked_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."express_locked_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."express_locked_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "express_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."express_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."express_opportunity_interest"("p_opportunity_id" "uuid", "p_repreneur_id" "uuid", "p_actor_id" "text", "p_expressed_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "external_pursuit_actor_context"("p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_actor_context"("p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_actor_context"("p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_append_audit"("p_dossier_id" "uuid", "p_event" "public"."external_pursuit_audit_event_type", "p_actor" "text", "p_key" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_append_audit"("p_dossier_id" "uuid", "p_event" "public"."external_pursuit_audit_event_type", "p_actor" "text", "p_key" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_append_audit"("p_dossier_id" "uuid", "p_event" "public"."external_pursuit_audit_event_type", "p_actor" "text", "p_key" "text", "p_metadata" "jsonb") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_attachment_cleanup_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_attachment_cleanup_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_attachment_cleanup_for_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_attachment_for_actor"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_attachment_for_actor"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_attachment_for_actor"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_attachment_map_for_actor"("p_dossier_ids" "uuid"[], "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_attachment_map_for_actor"("p_dossier_ids" "uuid"[], "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_attachment_map_for_actor"("p_dossier_ids" "uuid"[], "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_attachment_upload_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_attachment_upload_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_attachment_upload_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_attachments_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_attachments_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_attachments_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_board_for_actor"("p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_board_for_actor"("p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_board_for_actor"("p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_capacity_for_staff"("p_actor_user_id" "text", "p_as_of" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_capacity_for_staff"("p_actor_user_id" "text", "p_as_of" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_capacity_for_staff"("p_actor_user_id" "text", "p_as_of" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "external_pursuit_deletion_fulfillment_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_deletion_fulfillment_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_deletion_fulfillment_replay"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "external_pursuit_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."external_pursuit_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."external_pursuit_for_actor"("p_dossier_id" "uuid", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "fail_opportunity_memo_notification"("p_match_id" "uuid", "p_failed_at" timestamp with time zone, "p_error" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fail_opportunity_memo_notification"("p_match_id" "uuid", "p_failed_at" timestamp with time zone, "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fail_opportunity_memo_notification"("p_match_id" "uuid", "p_failed_at" timestamp with time zone, "p_error" "text") TO "service_role";


--
-- Name: FUNCTION "finalize_external_pursuit_attachment_deletion"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."finalize_external_pursuit_attachment_deletion"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_external_pursuit_attachment_deletion"("p_dossier_id" "uuid", "p_attachment_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "finalize_idempotent_email_delivery"("p_email_log_id" "uuid", "p_resend_id" "text", "p_sent_at" timestamp with time zone, "p_target_date" "date"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."finalize_idempotent_email_delivery"("p_email_log_id" "uuid", "p_resend_id" "text", "p_sent_at" timestamp with time zone, "p_target_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_idempotent_email_delivery"("p_email_log_id" "uuid", "p_resend_id" "text", "p_sent_at" timestamp with time zone, "p_target_date" "date") TO "service_role";


--
-- Name: FUNCTION "finalize_ma_interaction_email_send"("p_interaction_id" "uuid", "p_actor" "text", "p_delivery_status" "text", "p_provider_message_id" "text", "p_delivery_error" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."finalize_ma_interaction_email_send"("p_interaction_id" "uuid", "p_actor" "text", "p_delivery_status" "text", "p_provider_message_id" "text", "p_delivery_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_ma_interaction_email_send"("p_interaction_id" "uuid", "p_actor" "text", "p_delivery_status" "text", "p_provider_message_id" "text", "p_delivery_error" "text") TO "service_role";


--
-- Name: FUNCTION "fulfill_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."fulfill_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fulfill_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "get_follow_up_suggestions"("p_now" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."get_follow_up_suggestions"("p_now" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_follow_up_suggestions"("p_now" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "guard_ma_contact_campaign_email_suppression"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_contact_campaign_email_suppression"() FROM PUBLIC;


--
-- Name: FUNCTION "guard_ma_cutover_run_immutability"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_cutover_run_immutability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_cutover_run_immutability"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_cutover_run_insert"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_cutover_run_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_cutover_run_insert"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_cutover_stage_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_cutover_stage_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_cutover_stage_mutation"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_interaction_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_interaction_mutation"() FROM PUBLIC;


--
-- Name: FUNCTION "guard_ma_interaction_opportunity_source_office"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_interaction_opportunity_source_office"() FROM PUBLIC;


--
-- Name: FUNCTION "guard_ma_provisional_acme_firm_identity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_acme_firm_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_provisional_acme_firm_identity"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_provisional_acme_office_identity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_acme_office_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_provisional_acme_office_identity"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_provisional_qa_person_affiliation_identity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_qa_person_affiliation_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_provisional_qa_person_affiliation_identity"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_provisional_qa_person_contact_identity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_qa_person_contact_identity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_provisional_qa_person_contact_identity"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_provisional_source_context_identity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_source_context_identity"() FROM PUBLIC;


--
-- Name: FUNCTION "guard_ma_provisional_source_cutover"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_source_cutover"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_ma_provisional_source_cutover"() TO "service_role";


--
-- Name: FUNCTION "guard_ma_provisional_source_review_event"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_ma_provisional_source_review_event"() FROM PUBLIC;


--
-- Name: FUNCTION "guard_opportunity_source_contact_integrity"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."guard_opportunity_source_contact_integrity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_opportunity_source_contact_integrity"() TO "service_role";


--
-- Name: FUNCTION "increment_email_count"("target_date" "date"); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."increment_email_count"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_email_count"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_email_count"("target_date" "date") TO "service_role";


--
-- Name: FUNCTION "journey_append_evidence"("p_match_id" "uuid", "p_event_type" "public"."opportunity_pursuit_evidence_type", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid", "p_document_id" "uuid", "p_evidence_reference" "text", "p_metadata" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_append_evidence"("p_match_id" "uuid", "p_event_type" "public"."opportunity_pursuit_evidence_type", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid", "p_document_id" "uuid", "p_evidence_reference" "text", "p_metadata" "jsonb") FROM PUBLIC;


--
-- Name: FUNCTION "journey_current_artifact_is_valid"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_artifact_is_valid"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_artifact_is_valid"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role") TO "service_role";


--
-- Name: FUNCTION "journey_current_cycle_event"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_cycle_event"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_cycle_event"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_current_cycle_started_at"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_cycle_started_at"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_cycle_started_at"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_current_dispatch_event"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_dispatch_event"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_dispatch_event"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_current_gate_1_event"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_gate_1_event"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_gate_1_event"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_current_gate_2_event"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_gate_2_event"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_gate_2_event"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_current_signed_validation_event"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_signed_validation_event"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_signed_validation_event"("p_match_id" "uuid", "p_role" "public"."opportunity_nda_artifact_role") TO "service_role";


--
-- Name: FUNCTION "journey_current_template_id"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_current_template_id"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_current_template_id"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_gate_2_satisfied"("p_match_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_gate_2_satisfied"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_gate_2_satisfied"("p_match_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_grant_confidential_access"("p_match_id" "uuid", "p_information_memo_document_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_nda_expires_at" timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_grant_confidential_access"("p_match_id" "uuid", "p_information_memo_document_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_nda_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_grant_confidential_access"("p_match_id" "uuid", "p_information_memo_document_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_nda_expires_at" timestamp with time zone) TO "service_role";


--
-- Name: FUNCTION "journey_record_evidence"("p_match_id" "uuid", "p_event_type" "text", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid", "p_document_id" "uuid", "p_evidence_reference" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_record_evidence"("p_match_id" "uuid", "p_event_type" "text", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid", "p_document_id" "uuid", "p_evidence_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_record_evidence"("p_match_id" "uuid", "p_event_type" "text", "p_actor" "text", "p_idempotency_key" "text", "p_artifact_id" "uuid", "p_document_id" "uuid", "p_evidence_reference" "text") TO "service_role";


--
-- Name: FUNCTION "journey_repreneur_authorized_template"("p_match_id" "uuid", "p_repreneur_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_repreneur_authorized_template"("p_match_id" "uuid", "p_repreneur_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_repreneur_authorized_template"("p_match_id" "uuid", "p_repreneur_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_repreneur_can_access_confidential"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_document_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_repreneur_can_access_confidential"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_document_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_repreneur_can_access_confidential"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_document_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "journey_revoke_confidential_access"("p_match_id" "uuid", "p_actor" "text", "p_reason" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_revoke_confidential_access"("p_match_id" "uuid", "p_actor" "text", "p_reason" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_revoke_confidential_access"("p_match_id" "uuid", "p_actor" "text", "p_reason" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "journey_start_pursuit"("p_match_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_evidence_reference" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_start_pursuit"("p_match_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_evidence_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_start_pursuit"("p_match_id" "uuid", "p_actor" "text", "p_idempotency_key" "text", "p_evidence_reference" "text") TO "service_role";


--
-- Name: FUNCTION "journey_submit_repreneur_signed_copy"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_submit_repreneur_signed_copy"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text") FROM PUBLIC;


--
-- Name: FUNCTION "journey_submit_repreneur_signed_copy_v2"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_submit_repreneur_signed_copy_v2"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_submit_repreneur_signed_copy_v2"("p_match_id" "uuid", "p_repreneur_id" "uuid", "p_actor_email" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text") TO "service_role";


--
-- Name: FUNCTION "journey_transition_terminal"("p_match_id" "uuid", "p_transition" "text", "p_actor" "text", "p_idempotency_key" "text", "p_closure_reason" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."journey_transition_terminal"("p_match_id" "uuid", "p_transition" "text", "p_actor" "text", "p_idempotency_key" "text", "p_closure_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journey_transition_terminal"("p_match_id" "uuid", "p_transition" "text", "p_actor" "text", "p_idempotency_key" "text", "p_closure_reason" "text") TO "service_role";


--
-- Name: FUNCTION "ma_contact_email_address_is_suppressed"("p_email" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_contact_email_address_is_suppressed"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_contact_email_address_is_suppressed"("p_email" "text") TO "service_role";


--
-- Name: FUNCTION "ma_contact_email_is_allowed"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_contact_email_is_allowed"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_contact_email_is_allowed"("p_contact_id" "uuid", "p_opportunity_id" "uuid", "p_purpose" "public"."ma_contact_email_purpose") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_activation_guard_present"("p_run_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_activation_guard_present"("p_run_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_activation_guard_present"("p_run_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_aggregate_value_is_sanitized"("p_value" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_aggregate_value_is_sanitized"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_aggregate_value_is_sanitized"("p_value" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_bounded_flat_object"("p_value" "jsonb", "p_allowed_keys" "text"[], "p_max_bytes" integer, "p_max_string_chars" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_bounded_flat_object"("p_value" "jsonb", "p_allowed_keys" "text"[], "p_max_bytes" integer, "p_max_string_chars" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_bounded_flat_object"("p_value" "jsonb", "p_allowed_keys" "text"[], "p_max_bytes" integer, "p_max_string_chars" integer) TO "service_role";


--
-- Name: FUNCTION "ma_cutover_locator_is_sanitized"("p_locator" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_locator_is_sanitized"("p_locator" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_locator_is_sanitized"("p_locator" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_payload_is_sanitized"("p_entity_kind" "text", "p_payload" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_payload_is_sanitized"("p_entity_kind" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_payload_is_sanitized"("p_entity_kind" "text", "p_payload" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_reconciliation_is_sanitized"("p_value" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_reconciliation_is_sanitized"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_reconciliation_is_sanitized"("p_value" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_related_ids_are_bounded"("p_value" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_related_ids_are_bounded"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_related_ids_are_bounded"("p_value" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_result_is_sanitized"("p_value" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_result_is_sanitized"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_result_is_sanitized"("p_value" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_review_decisions_are_sanitized"("p_value" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_review_decisions_are_sanitized"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_review_decisions_are_sanitized"("p_value" "jsonb") TO "service_role";


--
-- Name: FUNCTION "ma_cutover_supersession_guard_present"("p_run_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_cutover_supersession_guard_present"("p_run_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_cutover_supersession_guard_present"("p_run_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "ma_opportunity_contact_snapshot"("p_opportunity_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_opportunity_contact_snapshot"("p_opportunity_id" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "ma_opportunity_source_review_required"("p_opportunity_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_opportunity_source_review_required"("p_opportunity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ma_opportunity_source_review_required"("p_opportunity_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "ma_opportunity_source_snapshot"("p_opportunity_id" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."ma_opportunity_source_snapshot"("p_opportunity_id" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "move_external_pursuit_stage"("p_dossier_id" "uuid", "p_stage" "text", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."move_external_pursuit_stage"("p_dossier_id" "uuid", "p_stage" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."move_external_pursuit_stage"("p_dossier_id" "uuid", "p_stage" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: TABLE "ma_source_contacts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_source_contacts" TO "service_role";


--
-- Name: FUNCTION "move_ma_source_contact"("p_contact_id" "uuid", "p_expected_source_id" "uuid", "p_new_source_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_moved_by" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."move_ma_source_contact"("p_contact_id" "uuid", "p_expected_source_id" "uuid", "p_new_source_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_moved_by" "text") FROM PUBLIC;


--
-- Name: FUNCTION "normalize_ma_contact_display_name"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."normalize_ma_contact_display_name"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_ma_contact_display_name"() TO "service_role";


--
-- Name: FUNCTION "pdr_convert_proposal"("p_proposal_id" "uuid", "p_conversion_token" "uuid", "p_status_override" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."pdr_convert_proposal"("p_proposal_id" "uuid", "p_conversion_token" "uuid", "p_status_override" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pdr_convert_proposal"("p_proposal_id" "uuid", "p_conversion_token" "uuid", "p_status_override" "text") TO "service_role";


--
-- Name: FUNCTION "pdr_set_work_card_completed_at"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."pdr_set_work_card_completed_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pdr_set_work_card_completed_at"() TO "service_role";


--
-- Name: FUNCTION "prepare_external_pursuit_deletion_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prepare_external_pursuit_deletion_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_external_pursuit_deletion_fulfillment"("p_dossier_id" "uuid", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "prevent_ma_contact_email_policy_event_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_ma_contact_email_policy_event_mutation"() FROM PUBLIC;


--
-- Name: FUNCTION "prevent_ma_cutover_run_delete"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_ma_cutover_run_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_ma_cutover_run_delete"() TO "service_role";


--
-- Name: FUNCTION "prevent_ma_interaction_delivery_event_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_ma_interaction_delivery_event_mutation"() FROM PUBLIC;


--
-- Name: FUNCTION "prevent_ma_interaction_owner_verification_event_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_ma_interaction_owner_verification_event_mutation"() FROM PUBLIC;


--
-- Name: FUNCTION "prevent_ma_opportunity_date_correction_event_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_ma_opportunity_date_correction_event_mutation"() FROM PUBLIC;


--
-- Name: FUNCTION "prevent_ma_provisional_source_review_event_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_ma_provisional_source_review_event_mutation"() FROM PUBLIC;


--
-- Name: FUNCTION "prevent_ma_source_contact_move_mutation"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."prevent_ma_source_contact_move_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_ma_source_contact_move_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_ma_source_contact_move_mutation"() TO "service_role";


--
-- Name: FUNCTION "prevent_opportunity_closure_history_mutation"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."prevent_opportunity_closure_history_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_opportunity_closure_history_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_opportunity_closure_history_mutation"() TO "service_role";


--
-- Name: FUNCTION "prevent_opportunity_reference_change"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_opportunity_reference_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_opportunity_reference_change"() TO "service_role";


--
-- Name: FUNCTION "prevent_retained_opportunity_document_delete"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."prevent_retained_opportunity_document_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_retained_opportunity_document_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_retained_opportunity_document_delete"() TO "service_role";


--
-- Name: FUNCTION "prevent_w039_geography_adoption_evidence_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."prevent_w039_geography_adoption_evidence_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_w039_geography_adoption_evidence_mutation"() TO "service_role";


--
-- Name: FUNCTION "promote_waitlist_repreneur"("p_waitlist_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_actor_user_id" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."promote_waitlist_repreneur"("p_waitlist_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_actor_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_waitlist_repreneur"("p_waitlist_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_actor_user_id" "text") TO "service_role";


--
-- Name: FUNCTION "refresh_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."refresh_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid") TO "service_role";


--
-- Name: FUNCTION "register_external_pursuit_attachment"("p_dossier_id" "uuid", "p_storage_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_byte_size" bigint, "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."register_external_pursuit_attachment"("p_dossier_id" "uuid", "p_storage_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_byte_size" bigint, "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_external_pursuit_attachment"("p_dossier_id" "uuid", "p_storage_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_byte_size" bigint, "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "register_opportunity_nda_artifact"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_artifact_role" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text", "p_recorded_by" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."register_opportunity_nda_artifact"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_artifact_role" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text", "p_recorded_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_opportunity_nda_artifact"("p_opportunity_id" "uuid", "p_match_id" "uuid", "p_artifact_role" "text", "p_title" "text", "p_storage_path" "text", "p_file_name" "text", "p_file_size" bigint, "p_content_sha256" "text", "p_recorded_by" "text") TO "service_role";


--
-- Name: FUNCTION "reject_external_pursuit_audit_mutation"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."reject_external_pursuit_audit_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_external_pursuit_audit_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_external_pursuit_audit_mutation"() TO "service_role";


--
-- Name: FUNCTION "reject_external_pursuit_conversion_mutation"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."reject_external_pursuit_conversion_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_external_pursuit_conversion_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_external_pursuit_conversion_mutation"() TO "service_role";


--
-- Name: FUNCTION "reject_linked_nda_document_mutation"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."reject_linked_nda_document_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_linked_nda_document_mutation"() TO "service_role";


--
-- Name: FUNCTION "reject_opportunity_nda_artifact_mutation"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."reject_opportunity_nda_artifact_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_opportunity_nda_artifact_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_opportunity_nda_artifact_mutation"() TO "service_role";


--
-- Name: FUNCTION "reject_opportunity_pursuit_evidence_mutation"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."reject_opportunity_pursuit_evidence_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_opportunity_pursuit_evidence_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_opportunity_pursuit_evidence_mutation"() TO "service_role";


--
-- Name: FUNCTION "release_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."release_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_ma_source_email_send"("p_opportunity_id" "uuid", "p_reservation_token" "uuid") TO "service_role";


--
-- Name: FUNCTION "replace_repreneur_geography_targets"("p_repreneur_id" "uuid", "p_stable_keys" "text"[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."replace_repreneur_geography_targets"("p_repreneur_id" "uuid", "p_stable_keys" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_repreneur_geography_targets"("p_repreneur_id" "uuid", "p_stable_keys" "text"[]) TO "service_role";


--
-- Name: FUNCTION "request_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."request_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_external_pursuit_deletion"("p_dossier_id" "uuid", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "reserve_ma_source_email_send"("p_opportunity_id" "uuid", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."reserve_ma_source_email_send"("p_opportunity_id" "uuid", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_ma_source_email_send"("p_opportunity_id" "uuid", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "resolve_acme_provisional_source"("p_opportunity_id" "uuid", "p_replacement_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_actor" "text", "p_reason" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."resolve_acme_provisional_source"("p_opportunity_id" "uuid", "p_replacement_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_actor" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_acme_provisional_source"("p_opportunity_id" "uuid", "p_replacement_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_actor" "text", "p_reason" "text") TO "service_role";


--
-- Name: TABLE "geography_nodes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."geography_nodes" TO "service_role";


--
-- Name: FUNCTION "resolve_w039_geography_node"("p_value" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."resolve_w039_geography_node"("p_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_w039_geography_node"("p_value" "text") TO "service_role";


--
-- Name: FUNCTION "save_external_pursuit_contact"("p_dossier_id" "uuid", "p_contact_id" "uuid", "p_name" "text", "p_organisation" "text", "p_role_title" "text", "p_email" "text", "p_phone" "text", "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."save_external_pursuit_contact"("p_dossier_id" "uuid", "p_contact_id" "uuid", "p_name" "text", "p_organisation" "text", "p_role_title" "text", "p_email" "text", "p_phone" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_external_pursuit_contact"("p_dossier_id" "uuid", "p_contact_id" "uuid", "p_name" "text", "p_organisation" "text", "p_role_title" "text", "p_email" "text", "p_phone" "text", "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "save_opportunity_office_context"("p_opportunity_id" "uuid", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."save_opportunity_office_context"("p_opportunity_id" "uuid", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_opportunity_office_context"("p_opportunity_id" "uuid", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb") TO "service_role";


--
-- Name: FUNCTION "save_opportunity_office_context_legacy"("p_opportunity_id" "uuid", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."save_opportunity_office_context_legacy"("p_opportunity_id" "uuid", "p_source_office_id" "uuid", "p_affiliation_ids" "uuid"[], "p_primary_affiliation_id" "uuid", "p_description" "text", "p_target_status" "public"."opportunity_status", "p_actor" "text", "p_opportunity_fields" "jsonb") FROM PUBLIC;


--
-- Name: FUNCTION "set_ma_contact_campaign_email_suppression"("p_contact_id" "uuid", "p_suppressed" boolean, "p_reason" "text", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."set_ma_contact_campaign_email_suppression"("p_contact_id" "uuid", "p_suppressed" boolean, "p_reason" "text", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_ma_contact_campaign_email_suppression"("p_contact_id" "uuid", "p_suppressed" boolean, "p_reason" "text", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "set_task_actual_start"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."set_task_actual_start"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_actual_start"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_actual_start"() TO "service_role";


--
-- Name: FUNCTION "supersede_ma_cutover_run"("p_run_id" "uuid", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."supersede_ma_cutover_run"("p_run_id" "uuid", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supersede_ma_cutover_run"("p_run_id" "uuid", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "sync_opportunity_date_added_precision"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."sync_opportunity_date_added_precision"() FROM PUBLIC;


--
-- Name: FUNCTION "sync_repreneur_geography_targets_from_legacy"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."sync_repreneur_geography_targets_from_legacy"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_repreneur_geography_targets_from_legacy"() TO "service_role";


--
-- Name: FUNCTION "transition_repreneur_offer_decision"("p_repreneur_offer_id" "uuid", "p_repreneur_id" "uuid", "p_new_status" "text", "p_decline_reason_category" "text", "p_decline_reason_text" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."transition_repreneur_offer_decision"("p_repreneur_offer_id" "uuid", "p_repreneur_id" "uuid", "p_new_status" "text", "p_decline_reason_category" "text", "p_decline_reason_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_repreneur_offer_decision"("p_repreneur_offer_id" "uuid", "p_repreneur_id" "uuid", "p_new_status" "text", "p_decline_reason_category" "text", "p_decline_reason_text" "text") TO "service_role";


--
-- Name: FUNCTION "update_external_pursuit"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."update_external_pursuit"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_external_pursuit"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "update_external_pursuit_follow_up"("p_dossier_id" "uuid", "p_next_action" "text", "p_next_action_provided" boolean, "p_responsible_party" "text", "p_responsible_party_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."update_external_pursuit_follow_up"("p_dossier_id" "uuid", "p_next_action" "text", "p_next_action_provided" boolean, "p_responsible_party" "text", "p_responsible_party_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_external_pursuit_follow_up"("p_dossier_id" "uuid", "p_next_action" "text", "p_next_action_provided" boolean, "p_responsible_party" "text", "p_responsible_party_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "update_external_pursuit_v2"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_external_url" "text", "p_external_url_provided" boolean, "p_target_company" "text", "p_target_company_provided" boolean, "p_source_channel" "text", "p_source_channel_provided" boolean, "p_revenue_meur" numeric, "p_revenue_meur_provided" boolean, "p_ebitda_keur" numeric, "p_ebitda_keur_provided" boolean, "p_headcount" integer, "p_headcount_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."update_external_pursuit_v2"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_external_url" "text", "p_external_url_provided" boolean, "p_target_company" "text", "p_target_company_provided" boolean, "p_source_channel" "text", "p_source_channel_provided" boolean, "p_revenue_meur" numeric, "p_revenue_meur_provided" boolean, "p_ebitda_keur" numeric, "p_ebitda_keur_provided" boolean, "p_headcount" integer, "p_headcount_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_external_pursuit_v2"("p_dossier_id" "uuid", "p_title" "text", "p_stage" "text", "p_stage_provided" boolean, "p_availability" "text", "p_availability_provided" boolean, "p_due_at" "date", "p_due_at_provided" boolean, "p_shared_notes" "text", "p_shared_notes_provided" boolean, "p_staff_internal_notes" "text", "p_staff_notes_provided" boolean, "p_external_url" "text", "p_external_url_provided" boolean, "p_target_company" "text", "p_target_company_provided" boolean, "p_source_channel" "text", "p_source_channel_provided" boolean, "p_revenue_meur" numeric, "p_revenue_meur_provided" boolean, "p_ebitda_keur" numeric, "p_ebitda_keur_provided" boolean, "p_headcount" integer, "p_headcount_provided" boolean, "p_actor_user_id" "text", "p_idempotency_key" "text") TO "service_role";


--
-- Name: FUNCTION "update_journey_stage_trigger"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_journey_stage_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_journey_stage_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_journey_stage_trigger"() TO "service_role";


--
-- Name: FUNCTION "update_ma_cutover_updated_at"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."update_ma_cutover_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_ma_cutover_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_tasks_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_tasks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tasks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tasks_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: FUNCTION "upsert_clipboard"("slug_param" "text", "title_param" "text", "html_param" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."upsert_clipboard"("slug_param" "text", "title_param" "text", "html_param" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_clipboard"("slug_param" "text", "title_param" "text", "html_param" "text") TO "service_role";


--
-- Name: FUNCTION "validate_geography_node_parent"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."validate_geography_node_parent"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_geography_node_parent"() TO "service_role";


--
-- Name: FUNCTION "validate_w098_date_precision_write"("p_opportunity_id" "uuid", "p_opportunity_fields" "jsonb"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."validate_w098_date_precision_write"("p_opportunity_id" "uuid", "p_opportunity_fields" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_w098_date_precision_write"("p_opportunity_id" "uuid", "p_opportunity_fields" "jsonb") TO "service_role";


--
-- Name: FUNCTION "verify_ma_interaction_owner"("p_interaction_id" "uuid", "p_actor" "text"); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."verify_ma_interaction_owner"("p_interaction_id" "uuid", "p_actor" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_ma_interaction_owner"("p_interaction_id" "uuid", "p_actor" "text") TO "service_role";


--
-- Name: FUNCTION "wave_journey_guard_opportunity_lifecycle"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."wave_journey_guard_opportunity_lifecycle"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wave_journey_guard_opportunity_lifecycle"() TO "service_role";


--
-- Name: FUNCTION "wave_journey_guard_repreneur_artifact_origin"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."wave_journey_guard_repreneur_artifact_origin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wave_journey_guard_repreneur_artifact_origin"() TO "service_role";


--
-- Name: FUNCTION "wave_journey_is_enabled"(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION "public"."wave_journey_is_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wave_journey_is_enabled"() TO "service_role";


--
-- Name: TABLE "account"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."account" TO "anon";
GRANT ALL ON TABLE "public"."account" TO "authenticated";
GRANT ALL ON TABLE "public"."account" TO "service_role";


--
-- Name: TABLE "activities"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";


--
-- Name: TABLE "ai_generation_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE "public"."ai_generation_events" TO "service_role";


--
-- Name: TABLE "ai_generation_runs"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."ai_generation_runs" TO "service_role";


--
-- Name: TABLE "app_user_roles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."app_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."app_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user_roles" TO "service_role";


--
-- Name: TABLE "clipboard"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."clipboard" TO "anon";
GRANT ALL ON TABLE "public"."clipboard" TO "authenticated";
GRANT ALL ON TABLE "public"."clipboard" TO "service_role";


--
-- Name: TABLE "email_daily_counts"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."email_daily_counts" TO "anon";
GRANT ALL ON TABLE "public"."email_daily_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_daily_counts" TO "service_role";


--
-- Name: TABLE "email_logs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";


--
-- Name: TABLE "email_templates"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";


--
-- Name: TABLE "evaluation_criteria"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."evaluation_criteria" TO "anon";
GRANT ALL ON TABLE "public"."evaluation_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_criteria" TO "service_role";


--
-- Name: TABLE "external_pursuit_attachments"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_attachments" TO "service_role";


--
-- Name: TABLE "external_pursuit_audit_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_audit_events" TO "service_role";


--
-- Name: TABLE "external_pursuit_contacts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_contacts" TO "service_role";


--
-- Name: TABLE "external_pursuit_deletion_tombstones"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_deletion_tombstones" TO "service_role";


--
-- Name: TABLE "external_pursuit_notes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_notes" TO "service_role";


--
-- Name: TABLE "external_pursuit_opportunity_conversions"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_opportunity_conversions" TO "service_role";


--
-- Name: TABLE "external_pursuit_staff_notes"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."external_pursuit_staff_notes" TO "service_role";


--
-- Name: TABLE "intake_abandonment_tracking"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."intake_abandonment_tracking" TO "anon";
GRANT ALL ON TABLE "public"."intake_abandonment_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_abandonment_tracking" TO "service_role";


--
-- Name: TABLE "leadership_assessments"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."leadership_assessments" TO "anon";
GRANT ALL ON TABLE "public"."leadership_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."leadership_assessments" TO "service_role";


--
-- Name: TABLE "ma_contact_email_policy_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_contact_email_policy_events" TO "service_role";


--
-- Name: TABLE "ma_contact_office_affiliations"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ma_contact_office_affiliations" TO "service_role";


--
-- Name: TABLE "ma_contacts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ma_contacts" TO "service_role";


--
-- Name: TABLE "ma_cutover_runs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ma_cutover_runs" TO "service_role";


--
-- Name: TABLE "ma_cutover_stage_issues"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ma_cutover_stage_issues" TO "service_role";


--
-- Name: TABLE "ma_cutover_stage_rows"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ma_cutover_stage_rows" TO "service_role";


--
-- Name: TABLE "ma_firms"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ma_firms" TO "service_role";


--
-- Name: TABLE "ma_interaction_delivery_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_interaction_delivery_events" TO "service_role";


--
-- Name: TABLE "ma_interaction_legacy_migration_manifest"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_interaction_legacy_migration_manifest" TO "service_role";


--
-- Name: TABLE "ma_interaction_owner_verification_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_interaction_owner_verification_events" TO "service_role";


--
-- Name: TABLE "ma_interactions"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_interactions" TO "service_role";


--
-- Name: TABLE "ma_offices"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ma_offices" TO "service_role";


--
-- Name: TABLE "ma_opportunity_date_correction_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_opportunity_date_correction_events" TO "service_role";


--
-- Name: TABLE "ma_provisional_source_contexts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_provisional_source_contexts" TO "service_role";


--
-- Name: TABLE "ma_provisional_source_review_events"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_provisional_source_review_events" TO "service_role";


--
-- Name: TABLE "ma_source_contact_moves"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_source_contact_moves" TO "service_role";


--
-- Name: TABLE "ma_source_interactions"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_source_interactions" TO "service_role";


--
-- Name: TABLE "ma_source_networks"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_source_networks" TO "service_role";


--
-- Name: TABLE "ma_sources"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."ma_sources" TO "service_role";


--
-- Name: TABLE "ma_w039_geography_adoption_evidence"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."ma_w039_geography_adoption_evidence" TO "service_role";


--
-- Name: TABLE "ma_w039_geography_adoption_runs"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."ma_w039_geography_adoption_runs" TO "service_role";


--
-- Name: TABLE "ma_w039_release_control"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."ma_w039_release_control" TO "service_role";


--
-- Name: TABLE "notes"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";


--
-- Name: TABLE "notification_delivery_claims"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."notification_delivery_claims" TO "service_role";


--
-- Name: TABLE "offer_milestones"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."offer_milestones" TO "anon";
GRANT ALL ON TABLE "public"."offer_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_milestones" TO "service_role";


--
-- Name: TABLE "offers"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";


--
-- Name: TABLE "opportunity_closure_history"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."opportunity_closure_history" TO "service_role";


--
-- Name: TABLE "opportunity_documents"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."opportunity_documents" TO "service_role";


--
-- Name: TABLE "opportunity_ma_contacts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."opportunity_ma_contacts" TO "service_role";


--
-- Name: TABLE "opportunity_mandate_reference_counters"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."opportunity_mandate_reference_counters" TO "service_role";


--
-- Name: TABLE "opportunity_matches"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."opportunity_matches" TO "service_role";


--
-- Name: TABLE "opportunity_memo_notifications"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."opportunity_memo_notifications" TO "service_role";


--
-- Name: TABLE "opportunity_nda_artifacts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."opportunity_nda_artifacts" TO "service_role";


--
-- Name: TABLE "opportunity_pursuit_confidential_grants"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."opportunity_pursuit_confidential_grants" TO "service_role";


--
-- Name: TABLE "opportunity_pursuit_events"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."opportunity_pursuit_events" TO "service_role";


--
-- Name: TABLE "opportunity_pursuit_evidence"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."opportunity_pursuit_evidence" TO "service_role";


--
-- Name: TABLE "opportunity_source_contacts"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE "public"."opportunity_source_contacts" TO "service_role";


--
-- Name: TABLE "pdr_feedback"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pdr_feedback" TO "service_role";
GRANT SELECT ON TABLE "public"."pdr_feedback" TO "anon";
GRANT SELECT ON TABLE "public"."pdr_feedback" TO "authenticated";


--
-- Name: TABLE "pdr_goals"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pdr_goals" TO "service_role";
GRANT SELECT ON TABLE "public"."pdr_goals" TO "anon";
GRANT SELECT ON TABLE "public"."pdr_goals" TO "authenticated";


--
-- Name: TABLE "pdr_milestones"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pdr_milestones" TO "service_role";
GRANT SELECT ON TABLE "public"."pdr_milestones" TO "anon";
GRANT SELECT ON TABLE "public"."pdr_milestones" TO "authenticated";


--
-- Name: TABLE "pdr_proposals"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pdr_proposals" TO "service_role";
GRANT SELECT ON TABLE "public"."pdr_proposals" TO "anon";
GRANT SELECT ON TABLE "public"."pdr_proposals" TO "authenticated";


--
-- Name: TABLE "pdr_requests"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pdr_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."pdr_requests" TO "anon";
GRANT SELECT ON TABLE "public"."pdr_requests" TO "authenticated";


--
-- Name: SEQUENCE "pdr_work_card_reference_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."pdr_work_card_reference_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pdr_work_card_reference_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pdr_work_card_reference_seq" TO "service_role";


--
-- Name: TABLE "pdr_work_cards"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pdr_work_cards" TO "service_role";
GRANT SELECT ON TABLE "public"."pdr_work_cards" TO "anon";
GRANT SELECT ON TABLE "public"."pdr_work_cards" TO "authenticated";


--
-- Name: TABLE "rateLimit"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."rateLimit" TO "service_role";


--
-- Name: TABLE "repreneur_geography_targets"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."repreneur_geography_targets" TO "service_role";


--
-- Name: TABLE "repreneur_offers"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."repreneur_offers" TO "anon";
GRANT ALL ON TABLE "public"."repreneur_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."repreneur_offers" TO "service_role";


--
-- Name: TABLE "repreneurs"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."repreneurs" TO "anon";
GRANT ALL ON TABLE "public"."repreneurs" TO "authenticated";
GRANT ALL ON TABLE "public"."repreneurs" TO "service_role";


--
-- Name: TABLE "sector_taxonomy_legacy_20260720"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."sector_taxonomy_legacy_20260720" TO "anon";
GRANT ALL ON TABLE "public"."sector_taxonomy_legacy_20260720" TO "authenticated";
GRANT ALL ON TABLE "public"."sector_taxonomy_legacy_20260720" TO "service_role";


--
-- Name: TABLE "session"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."session" TO "anon";
GRANT ALL ON TABLE "public"."session" TO "authenticated";
GRANT ALL ON TABLE "public"."session" TO "service_role";


--
-- Name: TABLE "staff_ma_office_intake_projection"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."staff_ma_office_intake_projection" TO "service_role";


--
-- Name: TABLE "tasks"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";


--
-- Name: TABLE "user"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."user" TO "anon";
GRANT ALL ON TABLE "public"."user" TO "authenticated";
GRANT ALL ON TABLE "public"."user" TO "service_role";


--
-- Name: TABLE "verification"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."verification" TO "anon";
GRANT ALL ON TABLE "public"."verification" TO "authenticated";
GRANT ALL ON TABLE "public"."verification" TO "service_role";


--
-- Name: TABLE "waitlist"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";


--
-- Name: TABLE "wave_journey_settings"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,UPDATE ON TABLE "public"."wave_journey_settings" TO "service_role";


--
-- Name: TABLE "wavy_templates"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."wavy_templates" TO "anon";
GRANT ALL ON TABLE "public"."wavy_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."wavy_templates" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--




--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--




--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--




--
-- PostgreSQL database dump complete
--
