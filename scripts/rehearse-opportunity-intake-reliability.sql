-- Disposable migration-086 rehearsal assertions. Run only in an isolated
-- Supabase-compatible database after migrations 076-085, never production.

BEGIN;

DO $$
DECLARE
  firm_id UUID;
  archived_firm_id UUID;
  office_id UUID;
BEGIN
  INSERT INTO public.ma_firms (name, status, created_by, updated_by)
  VALUES ('TEST W088 office firm', 'active', 'qa', 'qa')
  RETURNING id INTO firm_id;

  SELECT created.office_id INTO office_id
  FROM public.create_ma_office_for_existing_firm(firm_id, 'Paris', 'qa') created;

  IF office_id IS NULL THEN
    RAISE EXCEPTION 'rehearsal_086_office_not_created';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ma_offices
    WHERE id = office_id AND (is_default OR status <> 'active' OR created_by <> 'qa')
  ) THEN
    RAISE EXCEPTION 'rehearsal_086_office_audit_or_real_flag_failed';
  END IF;

  BEGIN
    PERFORM * FROM public.create_ma_office_for_existing_firm(firm_id, ' paris ', 'qa');
    RAISE EXCEPTION 'rehearsal_086_duplicate_not_rejected';
  EXCEPTION WHEN OTHERS THEN
    IF POSITION('ma_real_office_name_already_exists' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
  END;

  INSERT INTO public.ma_firms (name, status, archived_at, created_by, updated_by)
  VALUES ('TEST W088 archived firm', 'archived', NOW(), 'qa', 'qa')
  RETURNING id INTO archived_firm_id;
  BEGIN
    PERFORM * FROM public.create_ma_office_for_existing_firm(archived_firm_id, 'Lyon', 'qa');
    RAISE EXCEPTION 'rehearsal_086_archived_firm_not_rejected';
  EXCEPTION WHEN OTHERS THEN
    IF POSITION('ma_existing_firm_not_active' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
  END;
END;
$$;

ROLLBACK;
