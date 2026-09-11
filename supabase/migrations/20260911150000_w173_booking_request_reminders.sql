-- W-173: staff-recorded Outlook booking request, with no provider send.
CREATE TABLE public.repreneur_booking_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (NULLIF(BTRIM(idempotency_key), '') IS NOT NULL),
  UNIQUE (recorded_by, idempotency_key)
);

CREATE INDEX repreneur_booking_request_events_latest_idx
  ON public.repreneur_booking_request_events (repreneur_id, sent_at DESC, id DESC);

ALTER TABLE public.repreneur_booking_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repreneur_booking_request_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.repreneur_booking_request_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.repreneur_booking_request_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_repreneur_booking_request_sent(
  p_repreneur_id UUID,
  p_sent_at TIMESTAMPTZ,
  p_recorded_by TEXT,
  p_idempotency_key TEXT
) RETURNS public.repreneur_booking_request_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing public.repreneur_booking_request_events%ROWTYPE;
  created public.repreneur_booking_request_events%ROWTYPE;
BEGIN
  IF p_repreneur_id IS NULL OR NULLIF(BTRIM(p_recorded_by), '') IS NULL OR p_sent_at IS NULL
    OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'booking_request_event_required_values_missing';
  END IF;
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff'
      AND user_id=p_recorded_by) <> 1 THEN
    RAISE EXCEPTION 'booking_request_event_staff_required';
  END IF;
  IF p_sent_at > NOW() THEN
    RAISE EXCEPTION 'booking_request_event_sent_at_must_not_be_future';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.repreneurs WHERE id = p_repreneur_id) THEN
    RAISE EXCEPTION 'booking_request_event_repreneur_not_found';
  END IF;

  -- Serializes retries without conflating a later explicit manual send.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_recorded_by || ':' || BTRIM(p_idempotency_key), 0));

  SELECT * INTO existing
  FROM public.repreneur_booking_request_events
  WHERE recorded_by = p_recorded_by AND idempotency_key = BTRIM(p_idempotency_key);
  IF FOUND THEN
    IF existing.repreneur_id IS DISTINCT FROM p_repreneur_id OR existing.sent_at IS DISTINCT FROM p_sent_at THEN
      RAISE EXCEPTION 'booking_request_event_idempotency_payload_conflict';
    END IF;
    RETURN existing;
  END IF;

  INSERT INTO public.repreneur_booking_request_events (
    repreneur_id, sent_at, recorded_by, idempotency_key
  ) VALUES (
    p_repreneur_id, p_sent_at, p_recorded_by, BTRIM(p_idempotency_key)
  ) RETURNING * INTO created;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.record_repreneur_booking_request_sent(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_repreneur_booking_request_sent(UUID, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
