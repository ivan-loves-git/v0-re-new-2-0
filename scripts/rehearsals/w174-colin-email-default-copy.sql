\set ON_ERROR_STOP on
BEGIN;

-- Synthetic state only. The rollback below restores the local check database.
INSERT INTO public.email_templates (
  template_key, subject, description, is_active, requires_consent,
  body_markdown, body_editable
) VALUES
(
  'ma_opportunity_validity_check',
  'CUSTOM validity subject', 'synthetic W174 rehearsal', FALSE, TRUE,
  $old$Bonjour {firstName},

Je me permets de vous contacter au sujet de {opportunityTitle}.

Pouvez-vous me confirmer si l'opportunite est toujours active, et si le calendrier vendeur a evolue depuis notre dernier echange ?

Si elle est toujours ouverte, nous serions preneurs des prochaines etapes utiles pour qualifier l'interet cote Re-New.

Merci beaucoup,

L'equipe Re-New$old$, TRUE
),
(
  'ma_process_follow_up',
  'Suivi du processus vendeur - {opportunityTitle}', 'synthetic W174 rehearsal', TRUE, FALSE,
  'CUSTOM process body', TRUE
),
(
  'booking_reminder',
  'Planifions un premier échange Re-New', 'synthetic W174 rehearsal', FALSE, TRUE,
  'CUSTOM booking body without a source registry', TRUE
),
(
  'interview_reminder',
  'Rappel : votre entretien Re-New demain', 'synthetic W174 rehearsal', TRUE, FALSE,
  NULL, FALSE
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  requires_consent = EXCLUDED.requires_consent,
  body_markdown = EXCLUDED.body_markdown,
  body_editable = EXCLUDED.body_editable,
  updated_at = '2000-01-01T00:00:00Z';

\ir ../../supabase/migrations/20260911160000_w174_colin_email_default_copy.sql

DO $$
DECLARE replay_time timestamptz;
BEGIN
  -- Custom subject survives while independently-known body changes.
  IF (SELECT subject FROM public.email_templates WHERE template_key = 'ma_opportunity_validity_check') <> 'CUSTOM validity subject'
     OR (SELECT body_markdown FROM public.email_templates WHERE template_key = 'ma_opportunity_validity_check') NOT LIKE 'Bonjour {firstName},%' THEN
    RAISE EXCEPTION 'w174_validity_independent_preservation_failed';
  END IF;
  IF (SELECT body_markdown FROM public.email_templates WHERE template_key = 'ma_opportunity_validity_check') NOT LIKE '%Nous nous permettons de vous contacter%' THEN
    RAISE EXCEPTION 'w174_known_body_not_updated';
  END IF;
  -- Known subject changes while custom body survives independently.
  IF (SELECT subject FROM public.email_templates WHERE template_key = 'ma_process_follow_up') <> 'Toujours d''actualité ? — {opportunityTitle}'
     OR (SELECT body_markdown FROM public.email_templates WHERE template_key = 'ma_process_follow_up') <> 'CUSTOM process body' THEN
    RAISE EXCEPTION 'w174_process_independent_preservation_failed';
  END IF;
  IF (SELECT subject FROM public.email_templates WHERE template_key = 'booking_reminder') <> 'Réservez votre entretien avec Re-New'
     OR (SELECT body_markdown FROM public.email_templates WHERE template_key = 'booking_reminder') <> 'CUSTOM booking body without a source registry' THEN
    RAISE EXCEPTION 'w174_unknown_booking_body_changed';
  END IF;
  IF (SELECT subject FROM public.email_templates WHERE template_key = 'interview_reminder') <> 'Rappel — votre entretien avec Re-New' THEN
    RAISE EXCEPTION 'w174_known_interview_subject_not_updated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.email_templates
    WHERE template_key IN ('ma_opportunity_validity_check','ma_process_follow_up','booking_reminder','interview_reminder')
      AND ((template_key IN ('ma_process_follow_up','interview_reminder') AND is_active IS NOT TRUE)
        OR (template_key IN ('ma_opportunity_validity_check','booking_reminder') AND is_active IS NOT FALSE)
        OR (template_key IN ('ma_opportunity_validity_check','booking_reminder') AND requires_consent IS NOT TRUE)
        OR (template_key IN ('ma_process_follow_up','interview_reminder') AND requires_consent IS NOT FALSE))
  ) THEN RAISE EXCEPTION 'w174_flags_changed'; END IF;
  SELECT updated_at INTO replay_time FROM public.email_templates WHERE template_key = 'booking_reminder';
  CREATE TEMP TABLE w174_replay_time(value timestamptz) ON COMMIT DROP;
  INSERT INTO w174_replay_time VALUES (replay_time);
END $$;

\ir ../../supabase/migrations/20260911160000_w174_colin_email_default_copy.sql

DO $$
BEGIN
  IF (SELECT updated_at FROM public.email_templates WHERE template_key = 'booking_reminder') <> (SELECT value FROM w174_replay_time) THEN
    RAISE EXCEPTION 'w174_replay_touched_already_changed_row';
  END IF;
END $$;

ROLLBACK;
