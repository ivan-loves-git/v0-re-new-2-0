-- Migration: Phase 8 NDA/info memo email template
-- Purpose: Seed the M&A firm request used after a repreneur pursuit is validated.

INSERT INTO public.email_templates (
  template_key,
  subject,
  description,
  requires_consent,
  body_markdown,
  body_editable
) VALUES (
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
)
ON CONFLICT (template_key) DO UPDATE
SET subject = EXCLUDED.subject,
    description = EXCLUDED.description,
    requires_consent = EXCLUDED.requires_consent,
    body_editable = TRUE,
    body_markdown = COALESCE(NULLIF(public.email_templates.body_markdown, ''), EXCLUDED.body_markdown),
    updated_at = NOW();
