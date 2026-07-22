-- Migration: Safe M&A contact moves with immutable historical attribution
-- Purpose: A contact can change current firm/email while existing opportunity
-- links keep the source firm and contact details that were true when linked.

BEGIN;

ALTER TABLE public.opportunity_source_contacts
  ADD COLUMN IF NOT EXISTS contact_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS contact_email_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone_snapshot TEXT;

UPDATE public.opportunity_source_contacts relation
SET
  contact_name_snapshot = COALESCE(relation.contact_name_snapshot, contact.name),
  contact_email_snapshot = COALESCE(relation.contact_email_snapshot, contact.email),
  contact_phone_snapshot = COALESCE(relation.contact_phone_snapshot, contact.phone)
FROM public.ma_source_contacts contact
WHERE contact.id = relation.contact_id
  AND (
    relation.contact_name_snapshot IS NULL
    OR relation.contact_email_snapshot IS NULL
    OR relation.contact_phone_snapshot IS NULL
  );

ALTER TABLE public.opportunity_source_contacts
  DROP CONSTRAINT IF EXISTS opportunity_source_contacts_contact_source_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunity_source_contacts_contact_fkey'
      AND conrelid = 'public.opportunity_source_contacts'::regclass
  ) THEN
    ALTER TABLE public.opportunity_source_contacts
      ADD CONSTRAINT opportunity_source_contacts_contact_fkey
      FOREIGN KEY (contact_id)
      REFERENCES public.ma_source_contacts(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_opportunity_source_contact_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
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

DROP TRIGGER IF EXISTS capture_opportunity_source_contact_snapshot ON public.opportunity_source_contacts;
CREATE TRIGGER capture_opportunity_source_contact_snapshot
  BEFORE INSERT ON public.opportunity_source_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_opportunity_source_contact_snapshot();

CREATE TABLE IF NOT EXISTS public.ma_source_contact_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ma_source_contacts(id) ON DELETE RESTRICT,
  old_source_id UUID NOT NULL REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  new_source_id UUID NOT NULL REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  old_name TEXT,
  new_name TEXT,
  old_email TEXT,
  new_email TEXT,
  old_phone TEXT,
  new_phone TEXT,
  moved_by TEXT NOT NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ma_source_contact_moves_contact
  ON public.ma_source_contact_moves(contact_id, moved_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_ma_source_contact_move_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ma_source_contact_move_history_is_immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_ma_source_contact_move_update ON public.ma_source_contact_moves;
CREATE TRIGGER prevent_ma_source_contact_move_update
  BEFORE UPDATE ON public.ma_source_contact_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ma_source_contact_move_mutation();

DROP TRIGGER IF EXISTS prevent_ma_source_contact_move_delete ON public.ma_source_contact_moves;
CREATE TRIGGER prevent_ma_source_contact_move_delete
  BEFORE DELETE ON public.ma_source_contact_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ma_source_contact_move_mutation();

CREATE OR REPLACE FUNCTION public.move_ma_source_contact(
  p_contact_id UUID,
  p_expected_source_id UUID,
  p_new_source_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_moved_by TEXT
)
RETURNS public.ma_source_contacts
LANGUAGE plpgsql
SET search_path = ''
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

ALTER TABLE public.ma_source_contact_moves ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ma_source_contact_moves FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.ma_source_contact_moves TO service_role;
REVOKE ALL ON FUNCTION public.move_ma_source_contact(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_ma_source_contact(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON TABLE public.ma_source_contact_moves IS
  'Append-only staff audit of old-to-new intermediary firm and contact details.';
COMMENT ON COLUMN public.opportunity_source_contacts.contact_email_snapshot IS
  'Immutable email attribution captured when the opportunity-contact relation is created.';

COMMIT;
