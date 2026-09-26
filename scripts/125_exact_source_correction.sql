-- #191 / Ticket #203. Additive, private correction capability only. No client
-- identifiers or data writes occur when this migration is installed.
BEGIN;

CREATE SCHEMA IF NOT EXISTS renew_private;
REVOKE ALL ON SCHEMA renew_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE renew_private.exact_source_manifests (
  id UUID PRIMARY KEY,
  authority_ref TEXT NOT NULL DEFAULT 're-new-team/renew-governance#191'
    CHECK (authority_ref = 're-new-team/renew-governance#191'),
  actor TEXT NOT NULL CHECK (BTRIM(actor) <> ''),
  items JSONB NOT NULL CHECK (JSONB_TYPEOF(items) = 'array' AND JSONB_ARRAY_LENGTH(items) = 3),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_txid BIGINT NOT NULL DEFAULT TXID_CURRENT(),
  CONSTRAINT exact_source_manifest_one_per_authority UNIQUE (authority_ref)
);

-- An intent is inserted before the guarded office UPDATE, and a receipt after
-- all three persisted changes. Both commit or neither does. No role receives
-- table access; the trigger can see only an owner-created intent in its txid.
CREATE TABLE renew_private.exact_source_events (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  manifest_id UUID NOT NULL REFERENCES renew_private.exact_source_manifests(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('apply', 'rollback')),
  phase TEXT NOT NULL CHECK (phase IN ('intent', 'receipt')),
  actor TEXT NOT NULL,
  authority_ref TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_id BIGINT NOT NULL DEFAULT TXID_CURRENT(),
  context JSONB NOT NULL CHECK (JSONB_TYPEOF(context) = 'array' AND JSONB_ARRAY_LENGTH(context) = 3),
  UNIQUE (manifest_id, operation, phase)
);

CREATE FUNCTION renew_private.deny_exact_source_evidence_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'exact_source_evidence_is_immutable';
END;
$$;
CREATE TRIGGER immutable_exact_source_manifests
  BEFORE UPDATE OR DELETE ON renew_private.exact_source_manifests
  FOR EACH ROW EXECUTE FUNCTION renew_private.deny_exact_source_evidence_mutation();
CREATE TRIGGER immutable_exact_source_events
  BEFORE UPDATE OR DELETE ON renew_private.exact_source_events
  FOR EACH ROW EXECUTE FUNCTION renew_private.deny_exact_source_evidence_mutation();
ALTER TABLE renew_private.exact_source_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE renew_private.exact_source_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON renew_private.exact_source_manifests, renew_private.exact_source_events
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION renew_private.sha256_json(p_value JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ENCODE(extensions.digest(CONVERT_TO(p_value::TEXT, 'UTF8'), 'sha256'), 'hex')
$$;

CREATE FUNCTION renew_private.opportunity_links_hash(p_opportunity_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT renew_private.sha256_json(COALESCE((
    SELECT JSONB_AGG(TO_JSONB(link) ORDER BY link.id)
    FROM public.opportunity_ma_contacts link WHERE link.opportunity_id = p_opportunity_id
  ), '[]'::JSONB))
$$;

-- The fingerprint includes historical and current dependencies, not just the
-- rows this correction writes. It deliberately excludes canonical contact
-- links, which have their own full-row fingerprint above.
CREATE FUNCTION renew_private.opportunity_dependencies_hash(p_opportunity_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT renew_private.sha256_json(JSONB_BUILD_OBJECT(
    'matches', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_matches x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'pursuit_events', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_pursuit_events x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'pursuit_evidence', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_pursuit_evidence x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'grants', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_pursuit_confidential_grants x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'handoffs', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_pursuit_handoff_deliveries x JOIN public.opportunity_matches m ON m.id=x.match_id WHERE m.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'documents', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_documents x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'nda_artifacts', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_nda_artifacts x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'interactions', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.ma_interactions x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'interaction_owner_verifications', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.ma_interaction_owner_verification_events x JOIN public.ma_interactions i ON i.id=x.interaction_id WHERE i.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'interaction_delivery', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.ma_interaction_delivery_events x JOIN public.ma_interactions i ON i.id=x.interaction_id WHERE i.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'reservations', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.reservation_token) FROM public.ma_source_email_send_reservations x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'reviews', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.staff_email_reviews x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'review_events', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.staff_email_review_events x JOIN public.staff_email_reviews r ON r.id=x.review_id WHERE r.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'legacy_contacts', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.source_id,x.contact_id) FROM public.opportunity_source_contacts x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'legacy_interactions', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.ma_source_interactions x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'memo_notifications', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.id) FROM public.opportunity_memo_notifications x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB),
    'im_cleanup', COALESCE((SELECT JSONB_AGG(TO_JSONB(x) ORDER BY x.document_id) FROM public.recipient_im_cleanup x WHERE x.opportunity_id=p_opportunity_id),'[]'::JSONB)
  ))
$$;

CREATE FUNCTION renew_private.identity_hash(p_office_id UUID, p_affiliation_ids UUID[])
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT renew_private.sha256_json(JSONB_BUILD_OBJECT(
    'office', (SELECT TO_JSONB(o) FROM public.ma_offices o WHERE o.id=p_office_id),
    'firm', (SELECT TO_JSONB(f) FROM public.ma_firms f JOIN public.ma_offices o ON o.firm_id=f.id WHERE o.id=p_office_id),
    'affiliations', COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('affiliation',TO_JSONB(a),'contact',TO_JSONB(c)) ORDER BY a.id)
      FROM public.ma_contact_office_affiliations a
      JOIN public.ma_contacts c ON c.id=a.contact_id
      WHERE a.id=ANY(p_affiliation_ids)
    ),'[]'::JSONB)
  ))
$$;

CREATE FUNCTION renew_private.assert_actual_staff(p_actor TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NULLIF(BTRIM(p_actor),'') IS NULL OR NOT EXISTS (
    SELECT 1 FROM public."user" account
    JOIN public.app_user_roles role ON role.role='staff'
      AND (role.user_id=account.id OR LOWER(BTRIM(role.email))=LOWER(BTRIM(account.email)))
    WHERE account.id=p_actor AND NULLIF(BTRIM(account.email),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'exact_source_correction_requires_actual_staff_actor';
  END IF;
END;
$$;

CREATE FUNCTION renew_private.assert_no_new_source_dependency(p_opportunity_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ma_source_email_send_reservations r
             WHERE r.opportunity_id=p_opportunity_id AND r.expires_at>CLOCK_TIMESTAMP())
    OR EXISTS (SELECT 1 FROM public.ma_interactions i
               WHERE i.opportunity_id=p_opportunity_id AND i.delivery_status='pending')
    OR EXISTS (SELECT 1 FROM public.ma_source_interactions i
               WHERE i.opportunity_id=p_opportunity_id AND i.status IN ('pending','sending','uncertain'))
    OR EXISTS (SELECT 1 FROM public.staff_email_reviews r
               WHERE r.opportunity_id=p_opportunity_id AND r.state IN ('pending','sending','uncertain'))
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_confidential_grants g
               WHERE g.opportunity_id=p_opportunity_id AND g.revoked_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts a
               WHERE a.opportunity_id=p_opportunity_id AND a.artifact_role::TEXT IN ('renew_signed_copy','repreneur_signed_copy'))
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries h
               JOIN public.opportunity_matches m ON m.id=h.match_id
               WHERE m.opportunity_id=p_opportunity_id)
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence e
               WHERE e.opportunity_id=p_opportunity_id
                 AND e.event_type::TEXT IN ('renew_signed_copy_validated','repreneur_signed_copy_validated','manual_package_dispatched','confidential_access_granted'))
    OR EXISTS (SELECT 1 FROM public.opportunity_matches m
               WHERE m.opportunity_id=p_opportunity_id
                 AND (public.journey_current_gate_1_event(m.id) IS NOT NULL
                   OR public.journey_current_gate_2_event(m.id) IS NOT NULL))
  THEN RAISE EXCEPTION 'exact_source_correction_has_new_or_unresolved_dependency'; END IF;
END;
$$;

CREATE FUNCTION renew_private.lock_dependency_rows(p_opportunity_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- The opportunity FOR UPDATE lock precedes this call. Child-of-child writes
  -- also have to wait on their locked match, interaction, review or document.
  PERFORM 1 FROM public.opportunity_ma_contacts x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_matches x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.ma_interactions x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.staff_email_reviews x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_documents x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_pursuit_confidential_grants x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_nda_artifacts x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_pursuit_evidence x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_pursuit_events x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_pursuit_handoff_deliveries x
    JOIN public.opportunity_matches m ON m.id=x.match_id WHERE m.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE OF x;
  PERFORM 1 FROM public.ma_interaction_delivery_events x
    JOIN public.ma_interactions i ON i.id=x.interaction_id WHERE i.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE OF x;
  PERFORM 1 FROM public.ma_interaction_owner_verification_events x
    JOIN public.ma_interactions i ON i.id=x.interaction_id WHERE i.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE OF x;
  PERFORM 1 FROM public.staff_email_review_events x
    JOIN public.staff_email_reviews r ON r.id=x.review_id WHERE r.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE OF x;
  PERFORM 1 FROM public.ma_source_email_send_reservations x WHERE x.opportunity_id=p_opportunity_id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_source_contacts x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.source_id,x.contact_id FOR UPDATE;
  PERFORM 1 FROM public.ma_source_interactions x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunity_memo_notifications x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.recipient_im_cleanup x WHERE x.opportunity_id=p_opportunity_id ORDER BY x.document_id FOR UPDATE;
END;
$$;

CREATE FUNCTION renew_private.lock_source_identities(
  p_old_office UUID, p_new_office UUID, p_old_affiliations UUID[], p_new_affiliation UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.ma_offices o WHERE o.id IN (p_old_office,p_new_office) ORDER BY o.id FOR UPDATE;
  PERFORM 1 FROM public.ma_contact_office_affiliations a
    WHERE a.id=ANY(p_old_affiliations) OR a.id=p_new_affiliation ORDER BY a.id FOR UPDATE;
  PERFORM 1 FROM public.ma_contacts c WHERE c.id IN (
    SELECT a.contact_id FROM public.ma_contact_office_affiliations a
    WHERE a.id=ANY(p_old_affiliations) OR a.id=p_new_affiliation
  ) ORDER BY c.id FOR UPDATE;
  PERFORM 1 FROM public.ma_firms f WHERE f.id IN (
    SELECT o.firm_id FROM public.ma_offices o WHERE o.id IN (p_old_office,p_new_office)
  ) ORDER BY f.id FOR UPDATE;
END;
$$;

-- No application or browser role can call this registration function. The
-- owner supplies the privately reviewed three IDs and mapping; the function
-- captures immutable versions/fingerprints under row locks in one statement.
CREATE FUNCTION public.register_exact_source_correction(
  p_manifest_id UUID, p_actor TEXT, p_targets JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target JSONB;
  opportunity_row public.opportunities%ROWTYPE;
  v_old_office UUID;
  v_new_office UUID;
  v_old_primary UUID;
  v_new_primary UUID;
  v_old_affiliations UUID[];
  v_items JSONB := '[]'::JSONB;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF p_manifest_id IS NULL OR JSONB_TYPEOF(p_targets) IS DISTINCT FROM 'array'
    OR JSONB_ARRAY_LENGTH(p_targets) <> 3 THEN
    RAISE EXCEPTION 'exact_source_manifest_requires_three_targets';
  END IF;
  PERFORM renew_private.assert_actual_staff(p_actor);
  IF EXISTS (SELECT 1 FROM renew_private.exact_source_manifests
             WHERE authority_ref='re-new-team/renew-governance#191') THEN
    RAISE EXCEPTION 'exact_source_manifest_authority_already_registered';
  END IF;

  FOR target IN SELECT value FROM JSONB_ARRAY_ELEMENTS(p_targets) AS input(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    PERFORM 1 FROM public.opportunities
      WHERE id=(target->>'opportunity_id')::UUID FOR UPDATE;
  END LOOP;

  FOR target IN SELECT value FROM JSONB_ARRAY_ELEMENTS(p_targets) AS input(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    IF JSONB_TYPEOF(target) IS DISTINCT FROM 'object'
      OR target - ARRAY['opportunity_id','reference','old_office_id','old_primary_affiliation_id','new_office_id','new_primary_affiliation_id'] <> '{}'::JSONB
      OR NULLIF(BTRIM(target->>'reference'),'') IS NULL
      OR (target->>'opportunity_id') IS NULL
      OR (target->>'old_office_id') IS NULL
      OR (target->>'old_primary_affiliation_id') IS NULL
      OR (target->>'new_office_id') IS NULL
      OR (target->>'new_primary_affiliation_id') IS NULL THEN
      RAISE EXCEPTION 'exact_source_manifest_target_shape_invalid';
    END IF;
    IF (target->>'opportunity_id')::UUID = ANY(v_ids) THEN
      RAISE EXCEPTION 'exact_source_manifest_duplicate_opportunity';
    END IF;
    v_ids := ARRAY_APPEND(v_ids,(target->>'opportunity_id')::UUID);
    v_old_office := (target->>'old_office_id')::UUID;
    v_new_office := (target->>'new_office_id')::UUID;
    v_old_primary := (target->>'old_primary_affiliation_id')::UUID;
    v_new_primary := (target->>'new_primary_affiliation_id')::UUID;
    SELECT * INTO opportunity_row FROM public.opportunities
      WHERE id=(target->>'opportunity_id')::UUID FOR UPDATE;
    PERFORM renew_private.lock_dependency_rows(opportunity_row.id);
    IF opportunity_row.id IS NULL OR opportunity_row.reference IS DISTINCT FROM target->>'reference'
      OR opportunity_row.status::TEXT <> 'paused' OR opportunity_row.is_demo
      OR NOT opportunity_row.source_identity_to_verify
      OR opportunity_row.source_office_id IS DISTINCT FROM v_old_office
      OR v_old_office=v_new_office THEN
      RAISE EXCEPTION 'exact_source_manifest_current_context_mismatch';
    END IF;
    IF EXISTS (SELECT 1 FROM renew_private.exact_source_manifests prior,
               JSONB_ARRAY_ELEMENTS(prior.items) item
               WHERE (item->>'opportunity_id')::UUID=opportunity_row.id) THEN
      RAISE EXCEPTION 'exact_source_manifest_opportunity_already_registered';
    END IF;
    SELECT ARRAY_AGG(DISTINCT link.affiliation_id ORDER BY link.affiliation_id)
      INTO v_old_affiliations FROM public.opportunity_ma_contacts link
      WHERE link.opportunity_id=opportunity_row.id AND link.is_active;
    IF COALESCE(ARRAY_LENGTH(v_old_affiliations,1),0)=0
      OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts link
          WHERE link.opportunity_id=opportunity_row.id AND link.is_active AND link.is_primary)<>1
      OR NOT EXISTS (SELECT 1 FROM public.opportunity_ma_contacts link
                     WHERE link.opportunity_id=opportunity_row.id AND link.is_active
                       AND link.is_primary AND link.affiliation_id=v_old_primary)
      OR EXISTS (SELECT 1 FROM public.opportunity_ma_contacts link
                 JOIN public.ma_contact_office_affiliations a ON a.id=link.affiliation_id
                 WHERE link.opportunity_id=opportunity_row.id AND link.is_active AND a.office_id<>v_old_office)
      OR EXISTS (SELECT 1 FROM public.opportunity_ma_contacts link
                 WHERE link.opportunity_id=opportunity_row.id AND link.affiliation_id=v_new_primary)
    THEN RAISE EXCEPTION 'exact_source_manifest_old_links_mismatch'; END IF;
    PERFORM renew_private.lock_source_identities(v_old_office,v_new_office,v_old_affiliations,v_new_primary);
    IF NOT EXISTS (
      SELECT 1 FROM public.ma_contact_office_affiliations a
      JOIN public.ma_contacts c ON c.id=a.contact_id
      JOIN public.ma_offices o ON o.id=a.office_id
      JOIN public.ma_firms f ON f.id=o.firm_id
      WHERE a.id=v_new_primary AND a.office_id=v_new_office AND a.is_active AND a.ended_at IS NULL
        AND c.status='active' AND o.status='active' AND NOT o.is_default AND f.status<>'archived'
        AND (NULLIF(BTRIM(c.first_name),'') IS NOT NULL OR NULLIF(BTRIM(c.last_name),'') IS NOT NULL)
        AND NULLIF(BTRIM(c.email),'') IS NOT NULL
        AND BTRIM(c.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) THEN RAISE EXCEPTION 'exact_source_manifest_target_identity_unusable'; END IF;
    PERFORM renew_private.assert_no_new_source_dependency(opportunity_row.id);
    v_items := v_items || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'opportunity_id',opportunity_row.id, 'reference',opportunity_row.reference,
      'old_office_id',v_old_office, 'old_primary_affiliation_id',v_old_primary,
      'old_affiliation_ids',TO_JSONB(v_old_affiliations),
      'new_office_id',v_new_office, 'new_primary_affiliation_id',v_new_primary,
      'opportunity_hash',renew_private.sha256_json(TO_JSONB(opportunity_row)),
      'links_hash',renew_private.opportunity_links_hash(opportunity_row.id),
      'dependency_hash',renew_private.opportunity_dependencies_hash(opportunity_row.id),
      'old_identity_hash',renew_private.identity_hash(v_old_office,v_old_affiliations),
      'new_identity_hash',renew_private.identity_hash(v_new_office,ARRAY[v_new_primary])
    ));
  END LOOP;
  INSERT INTO renew_private.exact_source_manifests(id,actor,items)
  VALUES(p_manifest_id,p_actor,v_items);
  RETURN p_manifest_id;
END;
$$;

-- Preserve migration 089's SECURITY DEFINER/search_path='' guard. The ledger
-- exception is exact-row, exact-pair, exact-transaction and exact-column only.
CREATE OR REPLACE FUNCTION public.guard_ma_interaction_opportunity_source_office()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.source_office_id IS DISTINCT FROM OLD.source_office_id THEN
    IF EXISTS (SELECT 1 FROM public.ma_source_email_send_reservations r
               WHERE r.opportunity_id=OLD.id AND r.expires_at>NOW()) THEN
      RAISE EXCEPTION 'ma_source_office_change_blocked_during_email_send';
    END IF;

    IF EXISTS (
      SELECT 1 FROM renew_private.exact_source_events event,
        JSONB_ARRAY_ELEMENTS(event.context) pair
      WHERE event.phase='intent' AND event.transaction_id=TXID_CURRENT()
        AND NOT EXISTS (SELECT 1 FROM renew_private.exact_source_events completed
                        WHERE completed.manifest_id=event.manifest_id
                          AND completed.operation=event.operation AND completed.phase='receipt')
        AND event.actor=NEW.updated_by AND event.recorded_at=NEW.updated_at
        AND (pair->>'opportunity_id')::UUID=OLD.id
        AND (pair->>'from_office_id')::UUID=OLD.source_office_id
        AND (pair->>'to_office_id')::UUID=NEW.source_office_id
        AND (pair->>'from_verify')::BOOLEAN=OLD.source_identity_to_verify
        AND (pair->>'to_verify')::BOOLEAN=NEW.source_identity_to_verify
        AND TO_JSONB(NEW)-ARRAY['source_office_id','source_identity_to_verify','updated_by','updated_at']
          = TO_JSONB(OLD)-ARRAY['source_office_id','source_identity_to_verify','updated_by','updated_at']
    ) THEN RETURN NEW; END IF;

    -- Once corrected, a normal save must not walk back to the historical
    -- office merely because the old sent rows happen to match that office.
    -- The compare-and-swap inverse is the only reversal until its receipt.
    IF EXISTS (
      SELECT 1 FROM renew_private.exact_source_events applied,
        JSONB_ARRAY_ELEMENTS(applied.context) pair
      WHERE applied.operation='apply' AND applied.phase='receipt'
        AND (pair->>'opportunity_id')::UUID=OLD.id
        AND NOT EXISTS (SELECT 1 FROM renew_private.exact_source_events reversed
                        WHERE reversed.manifest_id=applied.manifest_id
                          AND reversed.operation='rollback' AND reversed.phase='receipt')
    ) THEN RAISE EXCEPTION 'exact_source_correction_requires_inverse'; END IF;

    IF EXISTS (SELECT 1 FROM public.ma_interactions interaction
               WHERE interaction.opportunity_id=OLD.id
                 AND interaction.office_id IS DISTINCT FROM NEW.source_office_id) THEN
      RAISE EXCEPTION 'ma_interaction_history_blocks_source_office_change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_ma_interaction_opportunity_source_office()
  FROM PUBLIC, anon, authenticated, service_role;

-- Existing W-062 owner verification may legitimately update only audit fields
-- on a retained old-office interaction. Its original office/contact never
-- becomes current again; the separate append-only interaction mutation guard
-- still rejects changes to historical content or attribution.
CREATE OR REPLACE FUNCTION public.enforce_ma_interaction_office_context()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  affiliation_office_id UUID;
  opportunity_office_id UUID;
BEGIN
  IF NEW.affiliation_id IS NOT NULL THEN
    SELECT affiliation.office_id INTO affiliation_office_id
    FROM public.ma_contact_office_affiliations affiliation WHERE affiliation.id=NEW.affiliation_id;
    IF affiliation_office_id IS NULL OR affiliation_office_id IS DISTINCT FROM NEW.office_id THEN
      RAISE EXCEPTION 'ma_interaction_affiliation_must_match_office';
    END IF;
  END IF;
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT opportunity.source_office_id INTO opportunity_office_id
    FROM public.opportunities opportunity WHERE opportunity.id=NEW.opportunity_id;
    IF opportunity_office_id IS NULL OR opportunity_office_id IS DISTINCT FROM NEW.office_id THEN
      IF TG_OP='UPDATE'
        AND NEW.opportunity_id IS NOT DISTINCT FROM OLD.opportunity_id
        AND NEW.office_id IS NOT DISTINCT FROM OLD.office_id
        AND NEW.affiliation_id IS NOT DISTINCT FROM OLD.affiliation_id
        AND EXISTS (
          SELECT 1 FROM renew_private.exact_source_events intent
          JOIN renew_private.exact_source_events receipt
            ON receipt.manifest_id=intent.manifest_id AND receipt.operation='apply' AND receipt.phase='receipt'
          CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(intent.context) pair
          WHERE intent.operation='apply' AND intent.phase='intent'
            AND (pair->>'opportunity_id')::UUID=NEW.opportunity_id
            AND (pair->>'from_office_id')::UUID=NEW.office_id
            AND (pair->>'to_office_id')::UUID=opportunity_office_id
        ) THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'ma_interaction_opportunity_must_match_office';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_ma_interaction_office_context()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.apply_exact_source_correction(p_manifest_id UUID, p_actor TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  manifest renew_private.exact_source_manifests%ROWTYPE;
  receipt renew_private.exact_source_events%ROWTYPE;
  item JSONB;
  opportunity_row public.opportunities%ROWTYPE;
  v_id UUID;
  v_new_link UUID;
  v_pairs JSONB := '[]'::JSONB;
  v_post JSONB := '[]'::JSONB;
  v_affiliations UUID[];
BEGIN
  SELECT * INTO manifest FROM renew_private.exact_source_manifests WHERE id=p_manifest_id FOR UPDATE;
  IF manifest.id IS NULL OR manifest.actor IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'exact_source_manifest_or_actor_not_authorized';
  END IF;
  PERFORM renew_private.assert_actual_staff(p_actor);

  SELECT * INTO receipt FROM renew_private.exact_source_events
    WHERE manifest_id=p_manifest_id AND operation='apply' AND phase='receipt';
  IF receipt.id IS NOT NULL THEN
    FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(receipt.context) AS x(value)
      ORDER BY (value->>'opportunity_id')::UUID LOOP
      v_id := (item->>'opportunity_id')::UUID;
      PERFORM 1 FROM public.opportunities WHERE id=v_id FOR UPDATE;
      PERFORM renew_private.lock_dependency_rows(v_id);
      IF renew_private.sha256_json(TO_JSONB((SELECT o FROM public.opportunities o WHERE o.id=v_id))) IS DISTINCT FROM item->>'opportunity_hash'
        OR renew_private.opportunity_links_hash(v_id) IS DISTINCT FROM item->>'links_hash'
        OR renew_private.opportunity_dependencies_hash(v_id) IS DISTINCT FROM item->>'dependency_hash' THEN
        RAISE EXCEPTION 'exact_source_correction_replay_state_drifted';
      END IF;
    END LOOP;
    RETURN receipt.id;
  END IF;

  -- FK-backed dependent inserts require a KEY SHARE lock on the opportunity;
  -- these stable FOR UPDATE locks serialize sends, evidence, contacts and edits.
  FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(manifest.items) AS x(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    PERFORM 1 FROM public.opportunities WHERE id=(item->>'opportunity_id')::UUID FOR UPDATE;
  END LOOP;
  FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(manifest.items) AS x(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    v_id := (item->>'opportunity_id')::UUID;
    SELECT * INTO opportunity_row FROM public.opportunities WHERE id=v_id FOR UPDATE;
    PERFORM renew_private.lock_dependency_rows(v_id);
    IF opportunity_row.id IS NULL OR opportunity_row.reference IS DISTINCT FROM item->>'reference'
      OR opportunity_row.status::TEXT<>'paused' OR opportunity_row.is_demo
      OR NOT opportunity_row.source_identity_to_verify
      OR opportunity_row.source_office_id IS DISTINCT FROM (item->>'old_office_id')::UUID
      OR renew_private.sha256_json(TO_JSONB(opportunity_row)) IS DISTINCT FROM item->>'opportunity_hash'
      OR renew_private.opportunity_links_hash(v_id) IS DISTINCT FROM item->>'links_hash'
      OR renew_private.opportunity_dependencies_hash(v_id) IS DISTINCT FROM item->>'dependency_hash' THEN
      RAISE EXCEPTION 'exact_source_correction_stale_manifest';
    END IF;
    SELECT ARRAY_AGG(DISTINCT link.affiliation_id ORDER BY link.affiliation_id)
      INTO v_affiliations FROM public.opportunity_ma_contacts link
      WHERE link.opportunity_id=v_id AND link.is_active;
    IF TO_JSONB(v_affiliations) IS DISTINCT FROM item->'old_affiliation_ids'
      OR renew_private.identity_hash((item->>'old_office_id')::UUID,v_affiliations) IS DISTINCT FROM item->>'old_identity_hash'
      OR renew_private.identity_hash((item->>'new_office_id')::UUID,ARRAY[(item->>'new_primary_affiliation_id')::UUID]) IS DISTINCT FROM item->>'new_identity_hash' THEN
      RAISE EXCEPTION 'exact_source_correction_identity_drifted';
    END IF;
    PERFORM renew_private.lock_source_identities((item->>'old_office_id')::UUID,
      (item->>'new_office_id')::UUID,v_affiliations,(item->>'new_primary_affiliation_id')::UUID);
    IF renew_private.identity_hash((item->>'old_office_id')::UUID,v_affiliations) IS DISTINCT FROM item->>'old_identity_hash'
      OR renew_private.identity_hash((item->>'new_office_id')::UUID,ARRAY[(item->>'new_primary_affiliation_id')::UUID]) IS DISTINCT FROM item->>'new_identity_hash' THEN
      RAISE EXCEPTION 'exact_source_correction_identity_drifted';
    END IF;
    PERFORM renew_private.assert_no_new_source_dependency(v_id);
    v_new_link := GEN_RANDOM_UUID();
    v_pairs := v_pairs || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'opportunity_id',v_id, 'from_office_id',item->>'old_office_id',
      'to_office_id',item->>'new_office_id', 'from_verify',TRUE, 'to_verify',FALSE,
      'old_primary_affiliation_id',item->>'old_primary_affiliation_id',
      'new_primary_affiliation_id',item->>'new_primary_affiliation_id',
      'new_link_id',v_new_link, 'before_opportunity_hash',item->>'opportunity_hash',
      'before_links_hash',item->>'links_hash', 'dependency_hash',item->>'dependency_hash'
    ));
  END LOOP;

  INSERT INTO renew_private.exact_source_events(manifest_id,operation,phase,actor,authority_ref,context)
    VALUES(manifest.id,'apply','intent',p_actor,manifest.authority_ref,v_pairs);

  FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(v_pairs) AS x(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    v_id := (item->>'opportunity_id')::UUID;
    UPDATE public.opportunity_ma_contacts SET is_active=FALSE,removed_by=p_actor,removed_at=NOW()
      WHERE opportunity_id=v_id AND is_active;
    UPDATE public.opportunities SET source_office_id=(item->>'to_office_id')::UUID,
      source_identity_to_verify=FALSE,updated_by=p_actor,updated_at=NOW()
      WHERE id=v_id;
    INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,is_primary,linked_by,linked_at)
      VALUES((item->>'new_link_id')::UUID,v_id,(item->>'new_primary_affiliation_id')::UUID,TRUE,p_actor,NOW());
    PERFORM public.assert_opportunity_office_context(v_id);
    v_post := v_post || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'opportunity_id',v_id, 'office_id',item->>'to_office_id', 'active_link_id',item->>'new_link_id',
      'opportunity_hash',renew_private.sha256_json(TO_JSONB((SELECT o FROM public.opportunities o WHERE o.id=v_id))),
      'links_hash',renew_private.opportunity_links_hash(v_id),
      'dependency_hash',renew_private.opportunity_dependencies_hash(v_id)
    ));
  END LOOP;
  INSERT INTO renew_private.exact_source_events(manifest_id,operation,phase,actor,authority_ref,context)
    VALUES(manifest.id,'apply','receipt',p_actor,manifest.authority_ref,v_post)
    RETURNING * INTO receipt;
  RETURN receipt.id;
END;
$$;

-- Owner-only inverse. The canonical (opportunity, affiliation) uniqueness
-- requires reactivating the exact prior links and their retained snapshots;
-- the append-only ledger retains the correction and inverse transitions.
CREATE FUNCTION public.rollback_exact_source_correction(p_manifest_id UUID, p_actor TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  manifest renew_private.exact_source_manifests%ROWTYPE;
  applied renew_private.exact_source_events%ROWTYPE;
  receipt renew_private.exact_source_events%ROWTYPE;
  item JSONB;
  original JSONB;
  v_id UUID;
  v_restored_primary_link UUID;
  v_restored_count INTEGER;
  v_pairs JSONB := '[]'::JSONB;
  v_post JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO manifest FROM renew_private.exact_source_manifests WHERE id=p_manifest_id FOR UPDATE;
  IF manifest.id IS NULL OR manifest.actor IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'exact_source_manifest_or_actor_not_authorized';
  END IF;
  PERFORM renew_private.assert_actual_staff(p_actor);
  SELECT * INTO applied FROM renew_private.exact_source_events
    WHERE manifest_id=p_manifest_id AND operation='apply' AND phase='receipt';
  IF applied.id IS NULL THEN RAISE EXCEPTION 'exact_source_correction_not_applied'; END IF;
  SELECT * INTO receipt FROM renew_private.exact_source_events
    WHERE manifest_id=p_manifest_id AND operation='rollback' AND phase='receipt';
  IF receipt.id IS NOT NULL THEN
    FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(receipt.context) AS x(value)
      ORDER BY (value->>'opportunity_id')::UUID LOOP
      v_id := (item->>'opportunity_id')::UUID;
      PERFORM 1 FROM public.opportunities WHERE id=v_id FOR UPDATE;
      PERFORM renew_private.lock_dependency_rows(v_id);
      IF renew_private.sha256_json(TO_JSONB((SELECT o FROM public.opportunities o WHERE o.id=v_id))) IS DISTINCT FROM item->>'opportunity_hash'
        OR renew_private.opportunity_links_hash(v_id) IS DISTINCT FROM item->>'links_hash'
        OR renew_private.opportunity_dependencies_hash(v_id) IS DISTINCT FROM item->>'dependency_hash' THEN
        RAISE EXCEPTION 'exact_source_rollback_replay_state_drifted';
      END IF;
    END LOOP;
    RETURN receipt.id;
  END IF;

  FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(applied.context) AS x(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    PERFORM 1 FROM public.opportunities WHERE id=(item->>'opportunity_id')::UUID FOR UPDATE;
  END LOOP;
  FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(applied.context) AS x(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    v_id := (item->>'opportunity_id')::UUID;
    SELECT value INTO original FROM JSONB_ARRAY_ELEMENTS(manifest.items) AS x(value)
      WHERE (value->>'opportunity_id')::UUID=v_id;
    PERFORM 1 FROM public.opportunities WHERE id=v_id FOR UPDATE;
    PERFORM renew_private.lock_dependency_rows(v_id);
    PERFORM renew_private.lock_source_identities((original->>'old_office_id')::UUID,
      (original->>'new_office_id')::UUID,
      ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(original->'old_affiliation_ids')::UUID),
      (original->>'new_primary_affiliation_id')::UUID);
    IF renew_private.sha256_json(TO_JSONB((SELECT o FROM public.opportunities o WHERE o.id=v_id))) IS DISTINCT FROM item->>'opportunity_hash'
      OR renew_private.opportunity_links_hash(v_id) IS DISTINCT FROM item->>'links_hash'
      OR renew_private.opportunity_dependencies_hash(v_id) IS DISTINCT FROM item->>'dependency_hash'
      OR renew_private.identity_hash((original->>'old_office_id')::UUID,
           ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(original->'old_affiliation_ids')::UUID)) IS DISTINCT FROM original->>'old_identity_hash'
      OR renew_private.identity_hash((original->>'new_office_id')::UUID,
           ARRAY[(original->>'new_primary_affiliation_id')::UUID]) IS DISTINCT FROM original->>'new_identity_hash' THEN
      RAISE EXCEPTION 'exact_source_rollback_compare_and_swap_failed';
    END IF;
    PERFORM renew_private.assert_no_new_source_dependency(v_id);
    v_pairs := v_pairs || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'opportunity_id',v_id, 'from_office_id',original->>'new_office_id',
      'to_office_id',original->>'old_office_id', 'from_verify',FALSE, 'to_verify',TRUE,
      'corrected_link_id',item->>'active_link_id',
      'restored_affiliation_ids',original->'old_affiliation_ids',
      'restored_primary_affiliation_id',original->>'old_primary_affiliation_id'
    ));
  END LOOP;
  INSERT INTO renew_private.exact_source_events(manifest_id,operation,phase,actor,authority_ref,context)
    VALUES(manifest.id,'rollback','intent',p_actor,manifest.authority_ref,v_pairs);
  FOR item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(v_pairs) AS x(value)
    ORDER BY (value->>'opportunity_id')::UUID LOOP
    v_id := (item->>'opportunity_id')::UUID;
    UPDATE public.opportunity_ma_contacts SET is_active=FALSE,removed_by=p_actor,removed_at=NOW()
      WHERE id=(item->>'corrected_link_id')::UUID AND opportunity_id=v_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'exact_source_rollback_current_link_missing'; END IF;
    UPDATE public.opportunities SET source_office_id=(item->>'to_office_id')::UUID,
      source_identity_to_verify=TRUE,updated_by=p_actor,updated_at=NOW()
      WHERE id=v_id;
    UPDATE public.opportunity_ma_contacts
      SET is_active=TRUE,removed_by=NULL,removed_at=NULL
      WHERE opportunity_id=v_id AND NOT is_active
        AND affiliation_id IN (SELECT JSONB_ARRAY_ELEMENTS_TEXT(item->'restored_affiliation_ids')::UUID);
    GET DIAGNOSTICS v_restored_count = ROW_COUNT;
    IF v_restored_count <> JSONB_ARRAY_LENGTH(item->'restored_affiliation_ids') THEN
      RAISE EXCEPTION 'exact_source_rollback_original_links_missing';
    END IF;
    SELECT id INTO STRICT v_restored_primary_link FROM public.opportunity_ma_contacts
      WHERE opportunity_id=v_id AND is_active AND is_primary
        AND affiliation_id=(item->>'restored_primary_affiliation_id')::UUID;
    PERFORM public.assert_opportunity_office_context(v_id);
    v_post := v_post || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'opportunity_id',v_id, 'office_id',item->>'to_office_id', 'active_link_id',v_restored_primary_link,
      'opportunity_hash',renew_private.sha256_json(TO_JSONB((SELECT o FROM public.opportunities o WHERE o.id=v_id))),
      'links_hash',renew_private.opportunity_links_hash(v_id),
      'dependency_hash',renew_private.opportunity_dependencies_hash(v_id)
    ));
  END LOOP;
  INSERT INTO renew_private.exact_source_events(manifest_id,operation,phase,actor,authority_ref,context)
    VALUES(manifest.id,'rollback','receipt',p_actor,manifest.authority_ref,v_post)
    RETURNING * INTO receipt;
  RETURN receipt.id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_exact_source_correction(UUID,TEXT,JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_exact_source_correction(UUID,TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_exact_source_correction(UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.rollback_exact_source_correction(UUID,TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA renew_private FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
