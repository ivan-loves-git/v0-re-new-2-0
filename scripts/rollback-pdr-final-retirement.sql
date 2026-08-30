-- Reverses only the #42 final-retirement gate. Keep #43 foundation records,
-- objects, private metadata and Ivan-capability evidence intact.
DROP TRIGGER IF EXISTS wave_pdr_historical_work_cards_read_only ON public.pdr_work_cards;
DROP FUNCTION IF EXISTS public.wave_pdr_historical_work_cards_read_only();
DROP POLICY IF EXISTS wave_pdr_retire_legacy_attachment_browser_access ON storage.objects;

GRANT SELECT ON TABLE public.pdr_feedback, public.pdr_goals, public.pdr_milestones, public.pdr_proposals, public.pdr_requests, public.pdr_work_cards TO anon, authenticated;
UPDATE storage.buckets SET public=TRUE WHERE id='pdr-attachments';
NOTIFY pgrst, 'reload schema';
