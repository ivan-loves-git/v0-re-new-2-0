-- Migration: M&A source directory and intermediary email workflows
-- Purpose: Normalize opportunity source labels into editable source records and
-- seed reviewable email templates for intermediary follow-up.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS body_markdown TEXT;

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS body_editable BOOLEAN DEFAULT FALSE;

UPDATE public.email_templates
SET body_editable = FALSE
WHERE body_editable IS NULL;

ALTER TABLE public.email_templates
  ALTER COLUMN body_editable SET DEFAULT FALSE;

ALTER TABLE public.email_templates
  ALTER COLUMN body_editable SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ma_sources_type
  ON public.ma_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_ma_sources_contact_email
  ON public.ma_sources(LOWER(contact_email))
  WHERE contact_email IS NOT NULL;

INSERT INTO public.ma_sources (firm_name, source_type, created_by)
SELECT DISTINCT
  TRIM(o.source_label),
  'ma_firm'::ma_source_type,
  'migration:051'
FROM public.opportunities o
WHERE o.source_id IS NULL
  AND o.source_label IS NOT NULL
  AND TRIM(o.source_label) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.ma_sources s
    WHERE LOWER(TRIM(s.firm_name)) = LOWER(TRIM(o.source_label))
  );

UPDATE public.opportunities o
SET source_id = s.id,
    updated_at = NOW()
FROM public.ma_sources s
WHERE o.source_id IS NULL
  AND o.source_label IS NOT NULL
  AND TRIM(o.source_label) <> ''
  AND LOWER(TRIM(s.firm_name)) = LOWER(TRIM(o.source_label));

INSERT INTO public.email_templates (
  template_key,
  subject,
  description,
  requires_consent,
  body_markdown,
  body_editable
) VALUES
  (
    'ma_opportunity_validity_check',
    'Point rapide sur {opportunityTitle}',
    'M&A intermediary follow-up: check whether an opportunity is still valid.',
    FALSE,
    $body$Bonjour {firstName},

Je me permets de vous contacter au sujet de {opportunityTitle}.

Pouvez-vous me confirmer si l'opportunite est toujours active, et si le calendrier vendeur a evolue depuis notre dernier echange ?

Si elle est toujours ouverte, nous serions preneurs des prochaines etapes utiles pour qualifier l'interet cote Re-New.

Merci beaucoup,

L'equipe Re-New$body$,
    TRUE
  ),
  (
    'ma_request_more_information',
    'Informations complementaires - {opportunityTitle}',
    'M&A intermediary follow-up: request missing opportunity information.',
    FALSE,
    $body$Bonjour {firstName},

Merci pour les premiers elements partages sur {opportunityTitle}.

Pour avancer proprement cote Re-New, pourriez-vous nous transmettre les elements disponibles sur le perimetre, la rentabilite, le calendrier, et les attentes du vendeur ?

Une version anonymisee suffit si certains elements doivent rester confidentiels a ce stade.

Merci beaucoup,

L'equipe Re-New$body$,
    TRUE
  ),
  (
    'ma_repreneur_interest_feedback',
    'Retour d''interet repreneur - {opportunityTitle}',
    'M&A intermediary follow-up: share repreneur interest and request feedback.',
    FALSE,
    $body$Bonjour {firstName},

Nous avons un retour d'interet cote Re-New pour {opportunityTitle}.

Le profil concerne {repreneurName}. A ce stade, l'interet semble coherent avec le secteur, la taille d'entreprise, et la maturite du projet.

Pouvez-vous nous indiquer si vous souhaitez recevoir un court profil anonymise, ou si vous preferez organiser {nextStep} ?

Merci beaucoup,

L'equipe Re-New$body$,
    TRUE
  ),
  (
    'ma_nda_info_memo_request',
    'Demande NDA et info memo - {opportunityTitle}',
    'M&A intermediary follow-up: request the firm NDA and info memo after a pursuit is validated.',
    FALSE,
    $body$Bonjour {firstName},

Nous validons l'interet de {repreneurName} pour {opportunityTitle}.

Pouvez-vous nous transmettre votre NDA, ou le lien de signature, afin que le candidat le signe selon votre processus ? Une fois le NDA signe, pourriez-vous egalement nous partager l'info memo disponible ?

Contexte fiche de cadrage :
{repreneurProfile}

Pour clarifier le cadre : Re-New ne remplace pas votre NDA par un NDA generique. Nous suivons le document et le processus requis par votre cabinet.

Merci beaucoup,

L'equipe Re-New$body$,
    TRUE
  ),
  (
    'ma_process_follow_up',
    'Suivi de process - {opportunityTitle}',
    'M&A intermediary follow-up: clarify process stage and next step.',
    FALSE,
    $body$Bonjour {firstName},

Je reviens vers vous concernant {opportunityTitle}.

Pouvez-vous nous confirmer ou en est le process, les prochaines etapes prevues, et s'il existe une date limite pour manifester un interet qualifie ?

Cela nous aidera a cadrer le bon niveau d'effort cote Re-New et a eviter de pousser un profil hors timing.

Merci beaucoup,

L'equipe Re-New$body$,
    TRUE
  )
ON CONFLICT (template_key) DO UPDATE
SET subject = EXCLUDED.subject,
    description = EXCLUDED.description,
    requires_consent = EXCLUDED.requires_consent,
    body_editable = TRUE,
    body_markdown = COALESCE(NULLIF(public.email_templates.body_markdown, ''), EXCLUDED.body_markdown),
    updated_at = NOW();
