-- REVIEW CANDIDATE ONLY. Do not apply from this file without the release review.
-- It changes a field only when it is blank or exactly one enumerated, shipped
-- default. It preserves every unknown/custom subject or body independently,
-- and never touches is_active, body_editable, requires_consent, audiences or
-- any recipient/delivery setting. It creates no rows, trigger or send path.

WITH desired(template_key, subject, body_markdown) AS (
  VALUES
  (
    'ma_opportunity_validity_check',
    'Statut du process pour {opportunityTitle}',
    $body$Bonjour {firstName},

Nous nous permettons de vous contacter au sujet de {opportunityTitle}.

Pouvez-vous nous confirmer si l'opportunité est toujours active, et si vous êtes encore ouverts à étudier de nouveaux profils de repreneurs ?

Merci beaucoup,

L'équipe Re-New$body$
  ),
  (
    'ma_process_follow_up',
    'Toujours d''actualité ? — {opportunityTitle}',
    $body$Bonjour {firstName},

Nous revenons vers vous au sujet de {opportunityTitle}.

Pouvez-vous nous confirmer si l'opportunité est toujours active, et si vous restez ouverts à étudier de nouveaux profils de repreneurs ?

Si le dossier n'est plus d'actualité, n'hésitez pas à nous le signaler simplement en répondant à cet email.

Merci beaucoup,

L'équipe Re-New$body$
  ),
  ('booking_reminder', 'Réservez votre entretien avec Re-New', NULL),
  ('interview_reminder', 'Rappel — votre entretien avec Re-New', NULL)
), known_subject(template_key, value) AS (
  VALUES
  ('ma_opportunity_validity_check', 'Point rapide sur {opportunityTitle}'),
  ('ma_process_follow_up', 'Suivi de process - {opportunityTitle}'),
  ('ma_process_follow_up', 'Suivi du processus vendeur - {opportunityTitle}'),
  ('booking_reminder', 'Planifions un premier échange Re-New'),
  ('booking_reminder', 'Planifiez votre entretien Re-New'),
  ('interview_reminder', 'Rappel : votre entretien Re-New demain'),
  ('interview_reminder', 'Rappel de votre entretien Re-New')
), known_body(template_key, value) AS (
  VALUES
  (
    'ma_opportunity_validity_check',
    $body$Bonjour {firstName},

Je me permets de vous contacter au sujet de {opportunityTitle}.

Pouvez-vous me confirmer si l'opportunite est toujours active, et si le calendrier vendeur a evolue depuis notre dernier echange ?

Si elle est toujours ouverte, nous serions preneurs des prochaines etapes utiles pour qualifier l'interet cote Re-New.

Merci beaucoup,

L'equipe Re-New$body$
  ),
  (
    'ma_process_follow_up',
    $body$Bonjour {firstName},

Je reviens vers vous concernant {opportunityTitle}.

Pouvez-vous nous confirmer ou en est le process, les prochaines etapes prevues, et s'il existe une date limite pour manifester un interet qualifie ?

Cela nous aidera a cadrer le bon niveau d'effort cote Re-New et a eviter de pousser un profil hors timing.

Merci beaucoup,

L'equipe Re-New$body$
  ),
  (
    'ma_process_follow_up',
    $body$Bonjour {firstName},

Je reviens vers vous concernant {opportunityTitle}.

Pouvez-vous nous confirmer ou en est le processus vendeur, les prochaines etapes prevues, et s'il existe une date limite pour manifester un interet qualifie ?

Cela nous aidera a cadrer le bon niveau d'effort cote Re-New et a eviter de pousser un profil hors timing.

Merci beaucoup,

L'equipe Re-New$body$
  )
)
UPDATE public.email_templates AS template
SET
  subject = CASE
    WHEN NULLIF(BTRIM(template.subject), '') IS NULL
      OR EXISTS (SELECT 1 FROM known_subject WHERE known_subject.template_key = template.template_key AND known_subject.value = template.subject)
    THEN desired.subject
    ELSE template.subject
  END,
  body_markdown = CASE
    WHEN desired.body_markdown IS NULL THEN template.body_markdown
    WHEN NULLIF(BTRIM(template.body_markdown), '') IS NULL
      OR EXISTS (SELECT 1 FROM known_body WHERE known_body.template_key = template.template_key AND known_body.value = template.body_markdown)
    THEN desired.body_markdown
    ELSE template.body_markdown
  END,
  updated_at = CASE
    WHEN (NULLIF(BTRIM(template.subject), '') IS NULL OR EXISTS (SELECT 1 FROM known_subject WHERE known_subject.template_key = template.template_key AND known_subject.value = template.subject))
      OR (desired.body_markdown IS NOT NULL AND (NULLIF(BTRIM(template.body_markdown), '') IS NULL OR EXISTS (SELECT 1 FROM known_body WHERE known_body.template_key = template.template_key AND known_body.value = template.body_markdown)))
    THEN NOW()
    ELSE template.updated_at
  END
FROM desired
WHERE template.template_key = desired.template_key
  AND (
    NULLIF(BTRIM(template.subject), '') IS NULL
    OR EXISTS (SELECT 1 FROM known_subject WHERE known_subject.template_key = template.template_key AND known_subject.value = template.subject)
    OR (desired.body_markdown IS NOT NULL AND (NULLIF(BTRIM(template.body_markdown), '') IS NULL OR EXISTS (SELECT 1 FROM known_body WHERE known_body.template_key = template.template_key AND known_body.value = template.body_markdown)))
  );

-- Unresolved by design: booking_reminder body has no source-backed database
-- default registry. Nonblank editable M&A bodies that do not exactly equal a
-- value above are custom/unknown and remain byte-for-byte unchanged.
