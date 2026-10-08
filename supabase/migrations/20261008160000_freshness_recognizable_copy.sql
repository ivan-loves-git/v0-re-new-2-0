-- #247 / #263 / #264: prospective copy, exact evidence and deliberate updates.
-- No opportunity, draft, template or sent-history values are rewritten.
BEGIN;
ALTER FUNCTION public.opportunity_freshness_candidates(uuid,timestamptz,boolean,uuid)
 RENAME TO opportunity_freshness_candidates_pre263;
REVOKE ALL ON FUNCTION public.opportunity_freshness_candidates_pre263(uuid,timestamptz,boolean,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.opportunity_freshness_candidates(
 p_contact_id uuid DEFAULT NULL,p_now timestamptz DEFAULT now(),p_exclude_recorded boolean DEFAULT true,p_ignore_review uuid DEFAULT NULL
) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT candidate || jsonb_build_object('title',coalesce(nullif(btrim(o.public_title),''),''),
   'revenue_meur',o.revenue_meur,'copy_contract','recognizable-v1')
 FROM public.opportunity_freshness_candidates_pre263(p_contact_id,p_now,p_exclude_recorded,p_ignore_review) candidate
 JOIN public.opportunities o ON o.id=(candidate->>'opportunity_id')::uuid;
$$;
REVOKE ALL ON FUNCTION public.opportunity_freshness_candidates(uuid,timestamptz,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.opportunity_freshness_candidates(uuid,timestamptz,boolean,uuid) TO service_role;

CREATE FUNCTION public.opportunity_freshness_assert_evidence(p_review_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; m public.opportunity_freshness_members%ROWTYPE; current_member jsonb;
BEGIN
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id;
 IF r.id IS NULL OR r.source_kind<>'freshness' OR r.namespace<>'REAL' OR NOT EXISTS(
  SELECT 1 FROM public.opportunity_freshness_members WHERE review_id=p_review_id) THEN
  RAISE EXCEPTION 'freshness_review_unavailable'; END IF;
 FOR m IN SELECT * FROM public.opportunity_freshness_members WHERE review_id=p_review_id ORDER BY opportunity_id LOOP
  -- Historic attempts keep the original evidence contract and immutable payload.
  IF r.attempted_payload IS NOT NULL AND m.frozen_member->>'copy_contract' IS DISTINCT FROM 'recognizable-v1' THEN
   SELECT c INTO current_member FROM public.opportunity_freshness_candidates_pre263(m.contact_id,now(),false,p_review_id) c
    WHERE c->>'opportunity_id'=m.opportunity_id::text;
  ELSE
   SELECT c INTO current_member FROM public.opportunity_freshness_candidates(m.contact_id,now(),false,p_review_id) c
    WHERE c->>'opportunity_id'=m.opportunity_id::text;
  END IF;
  IF current_member IS NULL OR current_member IS DISTINCT FROM m.frozen_member
   OR current_member->>'recipient_email' IS DISTINCT FROM lower(btrim(r.recipient_email)) THEN
   RAISE EXCEPTION 'freshness_member_drift_requires_review'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.opportunity_freshness_assert_words(p_review_id uuid,p_subject text,p_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m jsonb; title text; reference text; revenue_label text; expected_revenues integer := 0; displayed_revenues integer; words text := lower(coalesce(p_subject,'')||E'\n'||coalesce(p_body,''));
BEGIN
 FOR m IN SELECT frozen_member FROM public.opportunity_freshness_members WHERE review_id=p_review_id LOOP
  title := lower(btrim(coalesce(m->>'title',''))); reference := lower(btrim(coalesce(m->>'reference','')));
  IF m->>'copy_contract' IS DISTINCT FROM 'recognizable-v1' THEN RAISE EXCEPTION 'freshness_refresh_required'; END IF;
  IF title='' OR title=reference THEN RAISE EXCEPTION 'freshness_recognizable_title_required'; END IF;
  IF m->>'revenue_meur' IS NOT NULL THEN
   expected_revenues := expected_revenues + 1;
   revenue_label := title || ' (ca : ' || replace(trim_scale((m->>'revenue_meur')::numeric)::text,'.',',') || ' m€)';
   IF strpos(words,revenue_label)=0 THEN RAISE EXCEPTION 'freshness_recorded_revenue_required'; END IF;
  END IF;
  IF (reference<>'' AND strpos(words,reference)>0) OR strpos(words,title)=0 THEN
   RAISE EXCEPTION 'freshness_recognizable_copy_required'; END IF;
 END LOOP;
 SELECT count(*) INTO displayed_revenues FROM regexp_matches(words,'\mca[[:space:]]*:', 'g');
 IF displayed_revenues<>expected_revenues THEN RAISE EXCEPTION 'freshness_invented_or_missing_revenue'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.opportunity_freshness_assert_current(p_review_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE;
BEGIN
 PERFORM public.opportunity_freshness_assert_evidence(p_review_id);
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id;
 IF r.attempted_payload IS NULL THEN
  PERFORM public.opportunity_freshness_assert_words(p_review_id,r.subject,r.body_text);
 END IF;
END $$;

ALTER FUNCTION public.opportunity_freshness_edit(uuid,integer,text,text,text) RENAME TO opportunity_freshness_edit_pre263;
REVOKE ALL ON FUNCTION public.opportunity_freshness_edit_pre263(uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.opportunity_freshness_edit(p_review_id uuid,p_version integer,p_subject text,p_body text,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.staff_email_review_assert_actor(p_actor);
 PERFORM 1 FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 PERFORM public.opportunity_freshness_assert_evidence(p_review_id);
 PERFORM public.opportunity_freshness_assert_words(p_review_id,p_subject,p_body);
 RETURN public.opportunity_freshness_edit_pre263(p_review_id,p_version,p_subject,p_body,p_actor);
END $$;

CREATE FUNCTION public.opportunity_freshness_replace_words(p_review_id uuid,p_version integer,p_subject text,p_body text,p_template_version text,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE next_version integer;
BEGIN
 next_version := public.opportunity_freshness_edit(p_review_id,p_version,p_subject,p_body,p_actor);
 IF nullif(btrim(p_template_version),'') IS NULL THEN RAISE EXCEPTION 'freshness_template_version_required'; END IF;
 UPDATE public.staff_email_reviews SET template_version=p_template_version WHERE id=p_review_id;
 RETURN next_version;
END $$;

-- Revenue joins the same in-flight fence as title; no changed copy can race I/O.
DROP TRIGGER opportunity_freshness_guard_opportunity ON public.opportunities;
CREATE TRIGGER opportunity_freshness_guard_opportunity BEFORE UPDATE OF status,is_demo,source_office_id,source_identity_to_verify,date_added,date_added_precision,reference,public_title,sector,revenue_meur
 ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
REVOKE ALL ON FUNCTION public.opportunity_freshness_assert_evidence(uuid),public.opportunity_freshness_assert_words(uuid,text,text),
 public.opportunity_freshness_edit(uuid,integer,text,text,text),public.opportunity_freshness_replace_words(uuid,integer,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.opportunity_freshness_edit(uuid,integer,text,text,text),
 public.opportunity_freshness_replace_words(uuid,integer,text,text,text,text) TO service_role;
COMMIT;
