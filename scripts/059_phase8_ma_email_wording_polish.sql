-- Migration: Phase 8 M&A email wording polish
-- Purpose: Align intermediary email titles and copy with the validated pursuit workflow.

UPDATE public.email_templates
SET subject = 'Processus NDA et info memo - {opportunityTitle}',
    description = 'M&A intermediary follow-up: ask for the firm NDA process and info memo after a pursuit is validated.',
    body_editable = TRUE,
    body_markdown = CASE
      WHEN body_markdown IS NULL
        OR body_markdown = ''
        OR body_markdown LIKE '%Nous validons l''interet de {repreneurName}%'
      THEN $body$Bonjour {firstName},

Nous avons qualifie l'interet de {repreneurName} pour {opportunityTitle}.

Pouvez-vous nous indiquer le bon processus NDA pour avancer, ou nous transmettre votre lien/document de signature ?

Une fois le NDA signe, pourriez-vous egalement nous partager l'info memo ou les elements de presentation disponibles ?

Contexte fiche de cadrage :
{repreneurProfile}

Pour clarifier le cadre : Re-New ne remplace pas votre NDA par un NDA generique. Nous suivons le document et le processus requis par votre cabinet.

Merci beaucoup,

L'equipe Re-New$body$
      ELSE body_markdown
    END,
    updated_at = NOW()
WHERE template_key = 'ma_nda_info_memo_request';

UPDATE public.email_templates
SET subject = 'Suivi du processus vendeur - {opportunityTitle}',
    description = 'M&A intermediary follow-up: clarify seller process stage, timing, and next step.',
    body_editable = TRUE,
    body_markdown = CASE
      WHEN body_markdown IS NULL
        OR body_markdown = ''
        OR body_markdown LIKE '%Pouvez-vous nous confirmer ou en est le process,%'
      THEN $body$Bonjour {firstName},

Je reviens vers vous concernant {opportunityTitle}.

Pouvez-vous nous confirmer ou en est le processus vendeur, les prochaines etapes prevues, et s'il existe une date limite pour manifester un interet qualifie ?

Cela nous aidera a cadrer le bon niveau d'effort cote Re-New et a eviter de pousser un profil hors timing.

Merci beaucoup,

L'equipe Re-New$body$
      ELSE body_markdown
    END,
    updated_at = NOW()
WHERE template_key = 'ma_process_follow_up';
