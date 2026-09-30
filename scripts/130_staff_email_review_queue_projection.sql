-- #221 / #222: staff-only read projection for the complete email review backlog.
-- Additive and reversible: no review, delivery or contact row is changed.
BEGIN;

CREATE VIEW public.staff_email_review_queue
  WITH (security_invoker = true, security_barrier = true) AS
WITH identified AS (
  SELECT
    review.id,
    review.source_kind,
    review.template_key,
    review.subject,
    left(regexp_replace(review.body_text, '[[:space:]]+', ' ', 'g'), 320) AS body_preview,
    review.recipient_email,
    review.namespace,
    review.state,
    review.version,
    review.created_at,
    CASE WHEN review.source_kind = 'e6'
      THEN nullif(btrim(concat_ws(' ', repreneur.first_name, repreneur.last_name)), '')
      ELSE nullif(btrim(contact.display_name), '') END AS recipient_name,
    CASE WHEN review.source_kind = 'e6' THEN repreneur.avatar_url ELSE NULL END AS recipient_avatar_url,
    CASE WHEN review.source_kind = 'e6' THEN NULL ELSE nullif(btrim(firm.name), '') END AS company_name,
    CASE
      WHEN review.source_kind = 'freshness' THEN 'source_freshness'
      WHEN review.source_kind = 'e4' THEN 'e4_qualification'
      WHEN review.source_kind = 'e6' THEN 'e6_nda_ready'
      WHEN review.source_kind = 'e7' THEN 'e7_signed_copies'
      WHEN review.template_key = 'ma_opportunity_validity_check' THEN 'ma_validity_check'
      WHEN review.template_key = 'ma_request_more_information' THEN 'ma_more_information'
      WHEN review.template_key = 'ma_repreneur_interest_feedback' THEN 'ma_interest_feedback'
      WHEN review.template_key = 'ma_nda_info_memo_request' THEN 'ma_nda_memo_request'
      WHEN review.template_key = 'ma_process_follow_up' THEN 'ma_process_follow_up'
      ELSE 'ma_other'
    END AS purpose_key,
    review.body_text
  FROM public.staff_email_reviews review
  LEFT JOIN public.opportunity_ma_contacts contact_link ON contact_link.id = review.contact_link_id
  LEFT JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = contact_link.affiliation_id
  LEFT JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  LEFT JOIN public.ma_offices office ON office.id = affiliation.office_id
  LEFT JOIN public.ma_firms firm ON firm.id = office.firm_id
  LEFT JOIN public.opportunity_matches match_row ON match_row.id = review.match_id AND review.source_kind = 'e6'
  LEFT JOIN public.repreneurs repreneur ON repreneur.id = match_row.repreneur_id
), named AS (
  SELECT identified.*,
    CASE purpose_key
      WHEN 'source_freshness' THEN 'Source freshness'
      WHEN 'e4_qualification' THEN 'E4 qualification'
      WHEN 'e6_nda_ready' THEN 'E6 NDA ready'
      WHEN 'e7_signed_copies' THEN 'E7 signed copies'
      WHEN 'ma_validity_check' THEN 'Validity check'
      WHEN 'ma_more_information' THEN 'More information'
      WHEN 'ma_interest_feedback' THEN 'Interest feedback'
      WHEN 'ma_nda_memo_request' THEN 'NDA and memo request'
      WHEN 'ma_process_follow_up' THEN 'Process follow-up'
      ELSE 'Other M&A email'
    END AS purpose_label
  FROM identified
)
SELECT
  id, source_kind, template_key, subject, body_preview, recipient_email,
  namespace, state, version, created_at, recipient_name, recipient_avatar_url,
  company_name, purpose_key, purpose_label,
  lower(subject) AS message_sort,
  lower(purpose_label) AS purpose_sort,
  lower(coalesce(recipient_name, recipient_email)) AS recipient_sort,
  lower(coalesce(company_name, '')) AS company_sort,
  lower(concat_ws(' ', subject, body_text, recipient_email, recipient_name,
    company_name, purpose_label, template_key)) AS search_text
FROM named;

REVOKE ALL ON public.staff_email_review_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.staff_email_review_queue TO service_role;

COMMENT ON VIEW public.staff_email_review_queue IS
  'Service-role-only staff email queue. Canonical recipient identity and company are read through the frozen contact link or E6 match; search and sort run before pagination.';

COMMIT;
