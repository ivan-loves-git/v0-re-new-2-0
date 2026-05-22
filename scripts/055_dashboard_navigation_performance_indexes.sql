-- Dashboard navigation performance indexes
-- Run in Supabase SQL Editor or through the project migration flow.

-- Repreneur-heavy dashboard/list routes.
CREATE INDEX IF NOT EXISTS idx_repreneurs_created_desc
ON public.repreneurs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_repreneurs_journey_created
ON public.repreneurs(journey_stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadership_assessments_repreneur_completed
ON public.leadership_assessments(repreneur_id, completed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_activities_type_event_repreneur
ON public.activities(activity_type, event_date, repreneur_id)
WHERE event_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_repreneur_offers_repreneur_offered
ON public.repreneur_offers(repreneur_id, offered_at DESC);

-- Opportunity dashboard/work-surface routes.
CREATE INDEX IF NOT EXISTS idx_opportunities_added_created
ON public.opportunities(date_added DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_status_added
ON public.opportunities(status, date_added DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_opportunity_updated
ON public.opportunity_matches(opportunity_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_status_updated
ON public.opportunity_matches(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_repreneur_updated
ON public.opportunity_matches(repreneur_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_active_pursuit
ON public.opportunity_matches(opportunity_id, updated_at DESC)
WHERE status = 'active_pursuit';

CREATE INDEX IF NOT EXISTS idx_ma_sources_firm_name
ON public.ma_sources(firm_name);

-- Staff-role checks that run before protected dashboard data loads.
CREATE INDEX IF NOT EXISTS idx_app_user_roles_email
ON public.app_user_roles(lower(email));

CREATE INDEX IF NOT EXISTS idx_app_user_roles_user_id
ON public.app_user_roles(user_id);
