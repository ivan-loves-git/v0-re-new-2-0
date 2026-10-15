-- Ticket #262: firms have one normal operational state, plus retained archive.
BEGIN;

ALTER TABLE public.ma_firms ALTER COLUMN status SET DEFAULT 'active';

-- Preserve original profile/audit timestamps: this is a classification removal,
-- not a staff correction. Attribution is the approved migration and its receipt.
-- Only this known clock trigger is suspended; integrity triggers stay enabled.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='public.ma_firms'::regclass
      AND tgname='update_ma_firms_updated_at'
      AND tgenabled='O'
      AND tgfoid='public.update_updated_at_column()'::regprocedure
  ) THEN RAISE EXCEPTION 'ma_firm_normalization_clock_trigger_drift'; END IF;
END $$;
ALTER TABLE public.ma_firms DISABLE TRIGGER update_ma_firms_updated_at;
DO $$ DECLARE normalized INTEGER; BEGIN
  UPDATE public.ma_firms SET status='active' WHERE status='prospect';
  GET DIAGNOSTICS normalized=ROW_COUNT;
  RAISE NOTICE '#262 normalized % prospect firms; other values/history retained', normalized;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE public.ma_firms ENABLE TRIGGER update_ma_firms_updated_at;

ALTER TABLE public.ma_firms DROP CONSTRAINT ma_firms_status_check;
ALTER TABLE public.ma_firms ADD CONSTRAINT ma_firms_status_check
  CHECK (status IN ('active','archived'));

-- The retained, guarded cutover service explicitly sends prospect on INSERT.
-- Normalize that legacy input before storage so an old writer cannot recreate
-- the removed classification or fail midway through an approved future import.
-- UPDATE has no compatibility mapping: prospect remains invalid persisted state.
CREATE OR REPLACE FUNCTION public.normalize_ma_firm_legacy_creation_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.status := 'active';
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.normalize_ma_firm_legacy_creation_status() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS normalize_ma_firm_legacy_creation_status ON public.ma_firms;
CREATE TRIGGER normalize_ma_firm_legacy_creation_status BEFORE INSERT ON public.ma_firms
  FOR EACH ROW WHEN (NEW.status='prospect')
  EXECUTE FUNCTION public.normalize_ma_firm_legacy_creation_status();

-- Same audited office primitive, with archive as the sole firm-state veto.
CREATE OR REPLACE FUNCTION public.create_ma_office_for_existing_firm(
  p_firm_id UUID,
  p_office_name TEXT,
  p_office_city TEXT,
  p_actor TEXT DEFAULT NULL
)
RETURNS TABLE (
  firm_id UUID,
  firm_name TEXT,
  office_id UUID,
  office_name TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor TEXT;
  office_name_value TEXT;
  office_city_value TEXT;
  normalized_office_name TEXT;
  firm_row public.ma_firms%ROWTYPE;
  created_office_id UUID;
BEGIN
  actor := public.ma_profile_text(p_actor);
  office_name_value := public.ma_profile_text(p_office_name);
  office_city_value := public.ma_profile_text(p_office_city);

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;
  IF p_firm_id IS NULL THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF office_name_value IS NULL THEN
    RAISE EXCEPTION 'ma_real_office_name_required';
  END IF;

  IF office_city_value IS NULL THEN RAISE EXCEPTION 'ma_office_city_required'; END IF;

  -- Serialize all real-office additions for this firm/name pair before the
  -- duplicate check. The partial unique index remains the final guard.
  normalized_office_name := LOWER(BTRIM(office_name_value));
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ma_office:' || p_firm_id::TEXT || ':' || normalized_office_name, 113)
  );

  SELECT * INTO firm_row
  FROM public.ma_firms
  WHERE id = p_firm_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF firm_row.status = 'archived' THEN
    RAISE EXCEPTION 'ma_existing_firm_archived';
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
    city,
    status,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    firm_row.id,
    office_name_value,
    office_city_value,
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

REVOKE ALL ON FUNCTION public.create_ma_office_for_existing_firm(UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ma_office_for_existing_firm(UUID,TEXT,TEXT,TEXT) TO service_role;

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
