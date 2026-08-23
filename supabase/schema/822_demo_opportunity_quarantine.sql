-- W-126: DEMO is an explicit staff classification.  It is intentionally not
-- inferred from titles, references, sources, or any other user-facing text.
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.opportunities.is_demo IS
  'Staff-only operational classification. DEMO opportunities are denied from every repreneur-facing surface while staff lifecycle history is retained.';

-- This manifest is pinned to the read-only production preflight on 2026-08-23.
-- It contains stable identity plus a content fingerprint and dependent-row
-- cardinalities so the classification cannot be applied after drift.
CREATE OR REPLACE FUNCTION public.w126_demo_opportunity_manifest()
RETURNS TABLE (
  id UUID, reference TEXT, updated_at TIMESTAMPTZ, fingerprint TEXT,
  expected_matches INTEGER, expected_active_pursuits INTEGER,
  expected_documents INTEGER, expected_artifacts INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id::UUID, reference::TEXT, updated_at::TIMESTAMPTZ, fingerprint::TEXT,
         expected_matches::INTEGER, expected_active_pursuits::INTEGER,
         expected_documents::INTEGER, expected_artifacts::INTEGER
  FROM (VALUES
    ('565d3f3e-4801-4fb6-82ac-cea875d0e9bb','DEMO-OPP-20260517-01','2026-07-26T17:24:16.844847Z','bebe6f2d3c556b63672f9eb525be001fad62eee90a2cc0ba0e559fdff50475c3',2,1,2,0),
    ('4115464d-6993-4826-a408-f056bbd0b17b','DEMO-OPP-20260517-02','2026-07-26T17:24:16.844847Z','c40965c1c8baeed3be16780cfa9d53702ebade1f395390b1b651d2d80b939f8f',2,0,0,0),
    ('f8739ca9-d416-420d-a2e2-4c1eb9f1a779','DEMO-OPP-20260517-03','2026-07-26T17:24:16.844847Z','d08e22ebebbe1d155ce6fa2a0daa0c82e9fcb491ccd2a2c93bf86bd35934f43f',1,1,2,1),
    ('12545de1-e030-42a9-a810-cda6b05976df','DEMO-OPP-20260517-04','2026-07-26T17:24:16.844847Z','de61ef9a171cc52a75c757aa22e8657c235b34cd4749cd0cba025134063cae1d',2,0,0,0),
    ('c236fc5a-70fe-4ee3-9aad-5a13dfc0bad3','DEMO-OPP-20260517-05','2026-07-26T17:24:16.844847Z','8b7ee055790a6de2a1e7cb5c8bb70044a3398a3c75dc66abd2e72705a9ccb6ff',2,0,0,0),
    ('c1bc5e34-10ca-442f-bddc-c334de97c894','DEMO-OPP-20260517-06','2026-07-26T17:24:16.844847Z','eca444303f55e8dfde6cb2f9f64e77e309eb251047fd6e9fb1cef7b3d658e0ab',1,0,0,0),
    ('c82bba31-89d1-4dc7-bfc4-86e54dcba0c6','DEMO-OPP-20260517-07','2026-08-19T14:53:15.278255Z','66bab8fdf0db0c510d98cc67b7673f37ed21dbd10ffb821169de683924ae662a',1,0,0,0),
    ('65801637-4c7d-4563-9fe7-ab777d855d9f','DEMO-OPP-20260517-08','2026-07-26T17:24:16.844847Z','9ed5ba22437b50e8677a9a61865b7e8038c2caabaac815df08491d3f51958fc1',3,0,0,0),
    ('dab790a9-da08-4b19-b17a-61acfbd412dd','DEMO-OPP-20260517-09','2026-07-26T17:24:16.844847Z','535b4ac5aeff8fe19f9b3243829e9ffab13bb8e39a64a91c79b40f4cd02ca6d9',2,0,0,0),
    ('0683d19a-1c7f-43c7-aef5-42bb1aad9bc1','DEMO-OPP-20260517-10','2026-07-26T17:24:16.844847Z','16523ff12237bab014541d94968e916f2c3b3e34ed61f52ffc846539f280ae2e',2,0,0,0),
    ('ceabc0bf-9666-44f9-9b07-d8978c85308b','DEMO-OPP-20260517-11','2026-07-26T17:24:16.844847Z','bd55e4db0391b0de84482a834db9eaad9ce9d7649188746598e522f61cb802cc',2,1,0,0),
    ('1fc71f0b-8db5-487b-ba49-773858f2bf41','DEMO-OPP-20260517-12','2026-07-26T17:24:16.844847Z','1d16eecd715ace33154a5b97ef104987bd7f1588eb3ea41a954355546faed91c',2,0,0,0),
    ('294357da-f93f-4f91-beff-a4cc71a189f3','DEMO-OPP-20260517-13','2026-07-26T17:24:16.844847Z','b7b313573a2f92b4168b52cb02edcee547e027e4a9c88cb9e0f0e0f4278be788',3,0,0,0),
    ('bdaf07d0-0000-418a-bdd5-dcfa2f99cbce','DEMO-OPP-20260517-14','2026-07-26T17:24:16.844847Z','725c574ef45f2aee94020ae744e7cd432d536cd46eff6d6c7110e55f3e2119ca',0,0,0,0),
    ('3ba22943-a06f-48a5-82b3-00e8710f233b','DEMO-OPP-20260517-15','2026-07-26T17:24:16.844847Z','aa777044c08cf106d6cb4107b70de78d5b04e6e14c416e1016edc20c12e40865',1,0,0,0),
    ('bae28727-5767-44ad-a555-5e29f77e5193','Re-New - FR - 009','2026-08-19T14:52:00.414570Z','80ec9453dc4786d0b06c093a883fdf7e4e1266653c23d9cc8ee726627cb6b608',0,0,0,0),
    ('4706116f-26ed-4ad1-ad35-354eea309253','Re-New - IDF - 103','2026-08-21T04:27:05.798042Z','762e39dc3cdc43ecc99340647cb7930066d04a7d67f138b8e926b52a4bf2005a',3,1,0,0),
    ('c6609eab-8b37-4a1f-bee2-1e80d0eb7747','Re-New - IDF - 104','2026-08-21T04:27:05.798042Z','327ce33eee6b9402feefa696c00794428b42f5e874a7dc636c3b7cd3a6ae05bc',3,1,0,0),
    ('b1c26257-4760-4ce8-9d38-c27692ccd717','Re-New - IDF - 105','2026-08-21T04:27:05.798042Z','fabc4a46e0e5f1157a08fdf738f664e6059c99b9f34d1c50d8c07e81f830ce4a',3,1,0,0),
    ('61437655-6c8c-4a6b-afa4-739f65650a52','Re-New - IDF - 106','2026-08-21T04:27:05.798042Z','7197fc10cdd07b0e1c9eef82847f18e62c80e8736ebbd5d63f5a64de7aa0fdeb',3,1,0,0),
    ('aaeb7b8f-86f2-4f1a-aee7-837425a66091','Re-New - IDF - 107','2026-08-21T04:27:05.798042Z','fa9fac6aa856518edc24272620dd5d17c7239ed88a66571e8a78a1a9ac064fed',3,1,0,0),
    ('2a5c030f-d6df-4f11-a38b-ab5b71f896d4','ReNew - 999 - TEST','2026-08-10T08:15:03.360370Z','7224757a92e5002a85a30b1bccf73e96f9da0ca68798f03da66421669b80b063',1,1,6,4),
    ('8a59a776-3e11-46d6-a141-b6c2dbfd10c6','TEST-DOCX-NDA-20260808-0906','2026-08-08T07:29:39.612613Z','3821260dfa189d3279d9d4ee26fa6bf7726e36531333585004d999d175fca3ca',1,0,1,1),
    ('ab47dc6f-92ef-4075-a407-1ff8a5feb288','TEST-JOURNEY-20260807191052','2026-08-07T19:47:18.123450Z','929929205a366a9f34c8d5ac58c8ddf9e7a2b184dc3dd9142d84a2a61d53f880',2,0,6,5)
  ) AS manifest(id, reference, updated_at, fingerprint, expected_matches, expected_active_pursuits, expected_documents, expected_artifacts)
$$;

REVOKE ALL ON FUNCTION public.w126_demo_opportunity_manifest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w126_demo_opportunity_manifest() TO service_role;

CREATE OR REPLACE FUNCTION public.apply_w126_demo_opportunity_quarantine(
  p_actor TEXT
)
RETURNS TABLE (classified_rows INTEGER, active_pursuit_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_rows CONSTANT INTEGER := 24;
  v_matched_rows INTEGER;
  v_active_rows INTEGER;
  v_demo_rows INTEGER;
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'w126_demo_quarantine_actor_required';
  END IF;

  -- The manifest is an access-controlled exact list, shared with rollback.
  DROP TABLE IF EXISTS pg_temp.w126_manifest;
  CREATE TEMP TABLE pg_temp.w126_manifest ON COMMIT DROP AS
  SELECT * FROM public.w126_demo_opportunity_manifest();

  IF (SELECT COUNT(*) FROM pg_temp.w126_manifest) <> v_expected_rows THEN
    RAISE EXCEPTION 'w126_demo_quarantine_manifest_cardinality_mismatch';
  END IF;

  -- Lock the exact rows before checking every pinned invariant and updating.
  PERFORM 1 FROM public.opportunities o JOIN pg_temp.w126_manifest m ON m.id=o.id FOR UPDATE OF o;
  GET DIAGNOSTICS v_matched_rows = ROW_COUNT;
  IF v_matched_rows <> v_expected_rows THEN
    RAISE EXCEPTION 'w126_demo_quarantine_identity_mismatch';
  END IF;

  -- The parent row locks block new foreign-key references. Locking the current
  -- dependent rows as well prevents lifecycle/count drift during verification.
  PERFORM 1 FROM public.opportunity_matches match
  JOIN pg_temp.w126_manifest manifest ON manifest.id=match.opportunity_id
  FOR UPDATE OF match;
  PERFORM 1 FROM public.opportunity_documents document
  JOIN pg_temp.w126_manifest manifest ON manifest.id=document.opportunity_id
  FOR UPDATE OF document;
  PERFORM 1 FROM public.opportunity_nda_artifacts artifact
  JOIN pg_temp.w126_manifest manifest ON manifest.id=artifact.opportunity_id
  FOR UPDATE OF artifact;

  SELECT COUNT(*) INTO v_demo_rows
  FROM public.opportunities o JOIN pg_temp.w126_manifest m ON m.id=o.id
  WHERE o.is_demo;
  IF v_demo_rows = v_expected_rows THEN
    IF EXISTS (
      SELECT 1
      FROM pg_temp.w126_manifest m
      JOIN public.opportunities o ON o.id=m.id
      LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_matches WHERE opportunity_id=o.id) matches ON TRUE
      LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_matches WHERE opportunity_id=o.id AND status='active_pursuit') active_matches ON TRUE
      LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_documents WHERE opportunity_id=o.id) documents ON TRUE
      LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_nda_artifacts WHERE opportunity_id=o.id) artifacts ON TRUE
      WHERE o.reference IS DISTINCT FROM m.reference
         OR encode(extensions.digest(convert_to(concat_ws('|',o.id,o.reference,COALESCE(o.public_title,''),to_char(m.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'UTF8'),'sha256'),'hex') IS DISTINCT FROM m.fingerprint
         OR matches.value <> m.expected_matches
         OR active_matches.value <> m.expected_active_pursuits
         OR documents.value <> m.expected_documents
         OR artifacts.value <> m.expected_artifacts
    ) THEN
      RAISE EXCEPTION 'w126_demo_quarantine_retry_manifest_drift';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.opportunities o
      JOIN pg_temp.w126_manifest m ON m.id=o.id
      WHERE o.updated_by IS DISTINCT FROM v_actor
    ) THEN
      RAISE EXCEPTION 'w126_demo_quarantine_apply_actor_drift';
    END IF;
    SELECT COALESCE(SUM(expected_active_pursuits),0) INTO v_active_rows FROM pg_temp.w126_manifest;
    RETURN QUERY SELECT v_expected_rows, v_active_rows;
    RETURN;
  ELSIF v_demo_rows <> 0 THEN
    RAISE EXCEPTION 'w126_demo_quarantine_mixed_state';
  END IF;

  -- This is manifest verification, not classification: title/reference never
  -- select records at runtime; only the locked exact IDs can be classified.
  IF EXISTS (
    SELECT 1
    FROM pg_temp.w126_manifest m
    JOIN public.opportunities o ON o.id=m.id
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_matches WHERE opportunity_id=o.id) matches ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_matches WHERE opportunity_id=o.id AND status='active_pursuit') active_matches ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_documents WHERE opportunity_id=o.id) documents ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_nda_artifacts WHERE opportunity_id=o.id) artifacts ON TRUE
    WHERE o.reference IS DISTINCT FROM m.reference
       OR o.updated_at IS DISTINCT FROM m.updated_at
       OR encode(extensions.digest(convert_to(concat_ws('|',o.id,o.reference,COALESCE(o.public_title,''),to_char(o.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'UTF8'),'sha256'),'hex') IS DISTINCT FROM m.fingerprint
       OR matches.value <> m.expected_matches
       OR active_matches.value <> m.expected_active_pursuits
       OR documents.value <> m.expected_documents
       OR artifacts.value <> m.expected_artifacts
  ) THEN
    RAISE EXCEPTION 'w126_demo_quarantine_manifest_drift';
  END IF;

  UPDATE public.opportunities o
  SET is_demo=TRUE, updated_by=v_actor
  FROM pg_temp.w126_manifest m
  WHERE o.id=m.id AND o.is_demo IS DISTINCT FROM TRUE;

  SELECT COALESCE(SUM(expected_active_pursuits),0) INTO v_active_rows FROM pg_temp.w126_manifest;
  RETURN QUERY SELECT v_expected_rows, v_active_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_w126_demo_opportunity_quarantine(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_w126_demo_opportunity_quarantine(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.rollback_w126_demo_opportunity_quarantine(
  p_apply_actor TEXT,
  p_rollback_actor TEXT
)
RETURNS TABLE (rolled_back_rows INTEGER, active_pursuit_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_rows CONSTANT INTEGER := 24;
  v_matched_rows INTEGER;
  v_demo_rows INTEGER;
  v_active_rows INTEGER;
  v_apply_actor TEXT := NULLIF(BTRIM(p_apply_actor), '');
  v_rollback_actor TEXT := NULLIF(BTRIM(p_rollback_actor), '');
BEGIN
  IF v_apply_actor IS NULL OR v_rollback_actor IS NULL THEN
    RAISE EXCEPTION 'w126_demo_quarantine_rollback_actor_required';
  END IF;

  DROP TABLE IF EXISTS pg_temp.w126_manifest;
  CREATE TEMP TABLE pg_temp.w126_manifest ON COMMIT DROP AS
  SELECT * FROM public.w126_demo_opportunity_manifest();
  IF (SELECT COUNT(*) FROM pg_temp.w126_manifest) <> v_expected_rows THEN
    RAISE EXCEPTION 'w126_demo_quarantine_manifest_cardinality_mismatch';
  END IF;
  PERFORM 1 FROM public.opportunities o JOIN pg_temp.w126_manifest m ON m.id=o.id FOR UPDATE OF o;
  GET DIAGNOSTICS v_matched_rows = ROW_COUNT;
  IF v_matched_rows <> v_expected_rows THEN
    RAISE EXCEPTION 'w126_demo_quarantine_identity_mismatch';
  END IF;
  PERFORM 1 FROM public.opportunity_matches match
  JOIN pg_temp.w126_manifest manifest ON manifest.id=match.opportunity_id
  FOR UPDATE OF match;
  PERFORM 1 FROM public.opportunity_documents document
  JOIN pg_temp.w126_manifest manifest ON manifest.id=document.opportunity_id
  FOR UPDATE OF document;
  PERFORM 1 FROM public.opportunity_nda_artifacts artifact
  JOIN pg_temp.w126_manifest manifest ON manifest.id=artifact.opportunity_id
  FOR UPDATE OF artifact;
  IF EXISTS (
    SELECT 1
    FROM pg_temp.w126_manifest m
    JOIN public.opportunities o ON o.id=m.id
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_matches WHERE opportunity_id=o.id) matches ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_matches WHERE opportunity_id=o.id AND status='active_pursuit') active_matches ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_documents WHERE opportunity_id=o.id) documents ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*)::INTEGER AS value FROM public.opportunity_nda_artifacts WHERE opportunity_id=o.id) artifacts ON TRUE
    WHERE o.reference IS DISTINCT FROM m.reference
       OR encode(extensions.digest(convert_to(concat_ws('|',o.id,o.reference,COALESCE(o.public_title,''),to_char(m.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'UTF8'),'sha256'),'hex') IS DISTINCT FROM m.fingerprint
       OR matches.value <> m.expected_matches
       OR active_matches.value <> m.expected_active_pursuits
       OR documents.value <> m.expected_documents
       OR artifacts.value <> m.expected_artifacts
  ) THEN
    RAISE EXCEPTION 'w126_demo_quarantine_rollback_manifest_drift';
  END IF;
  SELECT COUNT(*) INTO v_demo_rows
  FROM public.opportunities o JOIN pg_temp.w126_manifest m ON m.id=o.id
  WHERE o.is_demo;
  IF v_demo_rows = 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.opportunities o
      JOIN pg_temp.w126_manifest m ON m.id=o.id
      WHERE o.updated_by IS DISTINCT FROM v_rollback_actor
    ) THEN
      RAISE EXCEPTION 'w126_demo_quarantine_rollback_state_drift';
    END IF;
    SELECT COALESCE(SUM(expected_active_pursuits),0) INTO v_active_rows FROM pg_temp.w126_manifest;
    RETURN QUERY SELECT v_expected_rows, v_active_rows;
    RETURN;
  ELSIF v_demo_rows <> v_expected_rows THEN
    RAISE EXCEPTION 'w126_demo_quarantine_rollback_mixed_state';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.w126_manifest m JOIN public.opportunities o ON o.id=m.id
    WHERE o.updated_by IS DISTINCT FROM v_apply_actor
  ) THEN
    RAISE EXCEPTION 'w126_demo_quarantine_rollback_apply_actor_drift';
  END IF;
  UPDATE public.opportunities o
  SET is_demo=FALSE, updated_by=v_rollback_actor
  FROM pg_temp.w126_manifest m
  WHERE o.id=m.id;
  SELECT COALESCE(SUM(expected_active_pursuits),0) INTO v_active_rows FROM pg_temp.w126_manifest;
  RETURN QUERY SELECT v_expected_rows, v_active_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_w126_demo_opportunity_quarantine(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_w126_demo_opportunity_quarantine(TEXT,TEXT) TO service_role;

-- The latest exact-match interest RPC remains the concurrency authority; DEMO
-- is checked inside its locked opportunity read, not only in application code.
CREATE OR REPLACE FUNCTION public.express_opportunity_interest(
  p_opportunity_id UUID, p_repreneur_id UUID, p_actor_id TEXT, p_expressed_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(match_id UUID, expressed_at TIMESTAMPTZ, notification_sent_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_opportunity public.opportunities%ROWTYPE; v_match public.opportunity_matches%ROWTYPE; v_has_match BOOLEAN:=FALSE;
BEGIN
 SELECT * INTO v_opportunity FROM public.opportunities WHERE id=p_opportunity_id AND status='active' AND NOT is_demo FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE opportunity_id=p_opportunity_id AND repreneur_id=p_repreneur_id FOR UPDATE; v_has_match:=FOUND;
 IF v_opportunity.repreneur_exposure='staff_only' AND (NOT v_has_match OR v_match.status NOT IN ('proposed','interested','declined','active_pursuit')) THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
 IF v_has_match AND v_match.status='active_pursuit' THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
 IF v_has_match AND ((v_match.nda_status='signed' AND v_match.nda_signed_at IS NULL) OR (v_match.nda_status='waived' AND (v_match.nda_waived_at IS NULL OR NULLIF(BTRIM(v_match.nda_waived_by),'') IS NULL))) THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
 PERFORM 1 FROM public.opportunity_matches WHERE opportunity_id=p_opportunity_id AND status='active_pursuit' AND repreneur_id<>p_repreneur_id FOR UPDATE;
 IF v_has_match AND v_match.status='interested' THEN IF v_match.interest_expressed_at IS NULL THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF; RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at; RETURN; END IF;
 IF v_has_match THEN UPDATE public.opportunity_matches SET status='interested',decline_reason_categories='{}',decline_reason_text=NULL,pursuit_stage=NULL,pursuit_stage_notes=NULL,pursuit_stage_updated_by=NULL,pursuit_stage_updated_at=NULL,reviewed_by=NULL,reviewed_at=NULL,interest_expressed_at=p_expressed_at,interest_notification_sent_at=NULL WHERE id=v_match.id RETURNING * INTO v_match;
 ELSE INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by,interest_expressed_at) VALUES(p_opportunity_id,p_repreneur_id,'interested',p_actor_id,p_expressed_at) RETURNING * INTO v_match; END IF;
 RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at;
END $$;

-- Atomic portal response update: ownership, lifecycle and DEMO eligibility are
-- checked under the same match/opportunity lock as the write.
CREATE OR REPLACE FUNCTION public.update_repreneur_opportunity_response(
  p_match_id UUID, p_repreneur_id UUID, p_status TEXT, p_decline_reason_categories TEXT[] DEFAULT '{}', p_decline_reason_text TEXT DEFAULT NULL
) RETURNS TABLE(match_id UUID, opportunity_id UUID, status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_opportunity public.opportunities%ROWTYPE;
BEGIN
 IF p_status NOT IN ('interested','declined') THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id AND repreneur_id=p_repreneur_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
 IF v_match.status NOT IN ('proposed','interested','declined') THEN RAISE EXCEPTION 'response_locked' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_opportunity FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active' AND NOT is_demo FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
 UPDATE public.opportunity_matches SET status=p_status,decline_reason_categories=CASE WHEN p_status='declined' THEN COALESCE(p_decline_reason_categories,'{}') ELSE '{}' END,decline_reason_text=CASE WHEN p_status='declined' THEN NULLIF(BTRIM(p_decline_reason_text),'') ELSE NULL END,reviewed_by=NULL,reviewed_at=NULL WHERE id=v_match.id;
 RETURN QUERY SELECT v_match.id,v_opportunity.id,p_status;
END $$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_can_access_confidential(p_match_id UUID,p_repreneur_id UUID,p_document_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.wave_journey_is_enabled() AND EXISTS(SELECT 1 FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id WHERE m.id=p_match_id AND m.repreneur_id=p_repreneur_id AND m.status='active_pursuit' AND o.status='active' AND NOT o.is_demo AND g.information_memo_document_id=p_document_id AND g.revoked_at IS NULL AND g.nda_expires_at>NOW() AND g.cycle_started_evidence_id=public.journey_current_cycle_event(m.id) AND g.gate_2_evidence_id=public.journey_current_gate_2_event(m.id) AND g.dispatch_evidence_id=public.journey_current_dispatch_event(m.id))
$$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_authorized_template(p_match_id UUID,p_repreneur_id UUID)
RETURNS TABLE(document_id UUID,storage_bucket TEXT,storage_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT d.id,d.storage_bucket,d.storage_path FROM public.wave_journey_settings settings JOIN public.opportunity_matches match ON match.id=p_match_id JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id JOIN public.opportunity_nda_artifacts artifact ON artifact.id=public.journey_current_template_id(match.id) JOIN public.opportunity_documents d ON d.id=artifact.document_id
 WHERE settings.singleton=TRUE AND settings.enabled=TRUE AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit' AND opportunity.status='active' AND NOT opportunity.is_demo AND public.journey_current_gate_1_event(match.id) IS NOT NULL AND artifact.opportunity_id=match.opportunity_id AND artifact.match_id IS NULL AND artifact.artifact_role='blank_template' AND d.opportunity_id=match.opportunity_id AND d.document_type='nda' AND d.visibility='staff_only' AND d.external_url IS NULL AND d.storage_bucket='opportunity-documents' AND d.storage_path LIKE match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%' AND ((LOWER(COALESCE(d.file_name,'')) LIKE '%.pdf' AND LOWER(COALESCE(d.mime_type,''))='application/pdf') OR (LOWER(COALESCE(d.file_name,'')) LIKE '%.docx' AND LOWER(COALESCE(d.mime_type,''))='application/vnd.openxmlformats-officedocument.wordprocessingml.document')) AND COALESCE(d.size_bytes,0)>0 LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy(p_match_id UUID,p_repreneur_id UUID,p_actor_email TEXT,p_title TEXT,p_storage_path TEXT,p_file_name TEXT,p_file_size BIGINT,p_content_sha256 TEXT)
RETURNS TABLE(artifact_id UUID,document_id UUID,version_number INTEGER) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_email TEXT; v_gate UUID; v_prior UUID; v_version INTEGER; v_document UUID; v_artifact UUID;
BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE; SELECT LOWER(BTRIM(email)) INTO v_email FROM public.repreneurs WHERE id=p_repreneur_id;
 IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR v_match.repreneur_id<>p_repreneur_id OR v_email IS NULL OR v_email<>LOWER(BTRIM(p_actor_email)) OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active' AND NOT is_demo) THEN RAISE EXCEPTION 'Only the active pursuit repreneur may submit this signed copy.'; END IF;
 v_gate:=public.journey_current_gate_1_event(p_match_id); IF v_gate IS NULL THEN RAISE EXCEPTION 'Current Gate 1 is required before signed-copy submission.'; END IF;
 IF NULLIF(BTRIM(p_title),'') IS NULL OR NULLIF(BTRIM(p_storage_path),'') IS NULL OR LOWER(p_file_name) NOT LIKE '%.pdf' OR p_file_size<=0 OR LOWER(p_content_sha256)!~'^[0-9a-f]{64}$' OR p_storage_path NOT LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/repreneur_signed_copy/%' THEN RAISE EXCEPTION 'Submit one retained PDF in the canonical signed-copy path.'; END IF;
 SELECT a.id,a.version_number INTO v_artifact,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1; IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,(SELECT a.document_id FROM public.opportunity_nda_artifacts a WHERE a.id=v_artifact),v_version; RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_match_id::TEXT||':repreneur_signed_copy',0)); SELECT a.id,a.document_id,a.version_number INTO v_artifact,v_document,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1; IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,v_document,v_version; RETURN; END IF;
 SELECT a.id,a.version_number+1 INTO v_prior,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' ORDER BY a.version_number DESC LIMIT 1; v_version:=COALESCE(v_version,1);
 INSERT INTO public.opportunity_documents(opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,size_bytes,mime_type,uploaded_by) VALUES(v_match.opportunity_id,p_title,'nda','staff_only','opportunity-documents',p_storage_path,p_file_name,p_file_size,'application/pdf',p_actor_email) RETURNING id INTO v_document; PERFORM set_config('wave.journey_portal_repreneur_upload','on',true); INSERT INTO public.opportunity_nda_artifacts(opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,supersedes_artifact_id,recorded_by,recorded_at) VALUES(v_match.opportunity_id,p_match_id,v_document,'repreneur_signed_copy',v_version,LOWER(p_content_sha256),v_prior,p_actor_email,clock_timestamp()) RETURNING id INTO v_artifact; RETURN QUERY SELECT v_artifact,v_document,v_version;
EXCEPTION WHEN unique_violation THEN SELECT a.id,a.document_id,a.version_number INTO v_artifact,v_document,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1; IF v_artifact IS NULL THEN RAISE; END IF; RETURN QUERY SELECT v_artifact,v_document,v_version;
END $$;

CREATE OR REPLACE FUNCTION public.claim_opportunity_memo_notification(p_opportunity_id UUID,p_match_id UUID DEFAULT NULL,p_attempted_at TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE(match_id UUID,opportunity_id UUID,repreneur_id UUID,recipient_email TEXT,repreneur_first_name TEXT,opportunity_title TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.opportunity_matches%ROWTYPE; v_email TEXT; v_first TEXT; v_title TEXT; v_claim UUID;
BEGIN
 SELECT m.* INTO v FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id JOIN public.repreneurs r ON r.id=m.repreneur_id LEFT JOIN public.opportunity_memo_notifications n ON n.match_id=m.id WHERE m.opportunity_id=p_opportunity_id AND (p_match_id IS NULL OR m.id=p_match_id) AND m.status='active_pursuit' AND o.status='active' AND NOT o.is_demo AND g.revoked_at IS NULL AND g.nda_expires_at>p_attempted_at AND g.cycle_started_evidence_id=public.journey_current_cycle_event(m.id) AND g.gate_2_evidence_id=public.journey_current_gate_2_event(m.id) AND g.dispatch_evidence_id=public.journey_current_dispatch_event(m.id) AND NULLIF(BTRIM(r.email),'') IS NOT NULL AND (n.match_id IS NULL OR (n.sent_at IS NULL AND (n.status IN ('pending','failed') OR (n.status='sending' AND n.last_attempt_at<p_attempted_at-INTERVAL '15 minutes')))) ORDER BY m.updated_at DESC LIMIT 1 FOR UPDATE OF m;
 IF v.id IS NULL THEN RETURN; END IF;
 SELECT BTRIM(email),COALESCE(NULLIF(BTRIM(first_name),''),'Madame, Monsieur') INTO v_email,v_first FROM public.repreneurs WHERE id=v.repreneur_id; SELECT COALESCE(NULLIF(BTRIM(public_title),''),'votre opportunite') INTO v_title FROM public.opportunities WHERE id=v.opportunity_id;
 INSERT INTO public.opportunity_memo_notifications(match_id,opportunity_id,repreneur_id,recipient_email) VALUES(v.id,v.opportunity_id,v.repreneur_id,v_email) ON CONFLICT ON CONSTRAINT opportunity_memo_notifications_match_id_key DO UPDATE SET recipient_email=EXCLUDED.recipient_email,updated_at=p_attempted_at WHERE opportunity_memo_notifications.sent_at IS NULL; UPDATE public.opportunity_memo_notifications n SET status='sending',attempt_count=n.attempt_count+1,last_attempt_at=p_attempted_at,failed_at=NULL,last_error=NULL,updated_at=p_attempted_at WHERE n.match_id=v.id AND n.sent_at IS NULL AND (n.status IN ('pending','failed') OR (n.status='sending' AND n.last_attempt_at<p_attempted_at-INTERVAL '15 minutes')) RETURNING n.match_id INTO v_claim; IF v_claim IS NULL THEN RETURN; END IF; RETURN QUERY SELECT v.id,v.opportunity_id,v.repreneur_id,v_email,v_first,v_title;
END $$;

REVOKE ALL ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ), public.update_repreneur_opportunity_response(UUID,UUID,TEXT,TEXT[],TEXT), public.journey_repreneur_can_access_confidential(UUID,UUID,UUID), public.journey_repreneur_authorized_template(UUID,UUID), public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT), public.claim_opportunity_memo_notification(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ), public.update_repreneur_opportunity_response(UUID,UUID,TEXT,TEXT[],TEXT), public.journey_repreneur_can_access_confidential(UUID,UUID,UUID), public.journey_repreneur_authorized_template(UUID,UUID), public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT), public.claim_opportunity_memo_notification(UUID,UUID,TIMESTAMPTZ) TO service_role;
