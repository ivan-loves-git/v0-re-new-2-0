\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  v_owner public.repreneurs%ROWTYPE;
  v_input jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO v_owner FROM public.repreneurs WHERE id = '76000000-0000-4000-8000-000000000004';
  v_input := JSONB_BUILD_OBJECT(
    'q12_geo_zones', JSONB_BUILD_ARRAY('all-france'),
    'q13_target_sectors_v2', JSONB_BUILD_ARRAY('Services aux entreprises (B2B)'),
    'q14_deal_size', JSONB_BUILD_ARRAY('3-5M'),
    'q16_equity', '>450',
    'target_revenue_min_meur', 1,
    'target_revenue_max_meur', 5,
    'target_ebitda_min_keur', 100,
    'target_ebitda_max_keur', 500,
    'target_ebitda_margin_min_pct', 10,
    'target_staff_size_min', 2,
    'target_staff_size_max', 50
  );
  BEGIN
    PERFORM public.w196_update_staff_target_thesis(
      v_owner.id, v_owner.updated_at, JSONB_SET(v_input, '{q16_equity}', '"forged"'::jsonb),
      'w173-staff', 'w173-staff@example.test',
      '76000000-0000-4000-8000-000000000080');
    RAISE EXCEPTION 'w196_invalid_taxonomy_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_invalid_thesis' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_update_staff_target_thesis(
      v_owner.id, v_owner.updated_at, JSONB_SET(v_input, '{target_staff_size_min}', '2.5'::jsonb),
      'w173-staff', 'w173-staff@example.test',
      '76000000-0000-4000-8000-000000000081');
    RAISE EXCEPTION 'w196_fractional_headcount_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_invalid_thesis' THEN RAISE; END IF;
  END;
  v_result := public.w196_update_staff_target_thesis(
    v_owner.id, v_owner.updated_at, v_input,
    'w173-staff', 'w173-staff@example.test',
    '76000000-0000-4000-8000-000000000096');
  IF v_result->>'eventId' IS NULL
    OR (SELECT staff_user_id FROM public.staff_assisted_profile_changes
      WHERE id = (v_result->>'eventId')::uuid) <> 'w173-staff'
    OR (SELECT repreneur_id FROM public.staff_assisted_profile_changes
      WHERE id = (v_result->>'eventId')::uuid) <> v_owner.id
    OR NOT (SELECT changed_fields @> ARRAY['q13_target_sectors_v2']::text[]
      FROM public.staff_assisted_profile_changes
      WHERE id = (v_result->>'eventId')::uuid)
  THEN RAISE EXCEPTION 'w196_profile_change_not_attributed'; END IF;
  IF public.w196_update_staff_target_thesis(
    v_owner.id, v_owner.updated_at, v_input,
    'w173-staff', 'w173-staff@example.test',
    '76000000-0000-4000-8000-000000000096')->>'eventId' IS DISTINCT FROM v_result->>'eventId'
  THEN RAISE EXCEPTION 'w196_profile_retry_not_idempotent'; END IF;
  BEGIN
    PERFORM public.w196_update_staff_target_thesis(
      v_owner.id, v_owner.updated_at, v_input,
      'w173-staff', 'w173-staff@example.test',
      '76000000-0000-4000-8000-000000000097');
    RAISE EXCEPTION 'w196_stale_profile_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_stale_profile' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_update_staff_target_thesis(
      v_owner.id, v_owner.updated_at, v_input,
      'w173-staff', 'forged@example.test',
      '76000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'w196_forged_profile_actor_email_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_denied' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_update_staff_target_thesis(
      v_owner.id, v_owner.updated_at, v_input,
      'not-staff', 'not-staff@example.test',
      '76000000-0000-4000-8000-000000000098');
    RAISE EXCEPTION 'w196_nonstaff_profile_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_denied' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
