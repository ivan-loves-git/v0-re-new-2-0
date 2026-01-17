-- Seed V1.0 Launch Tasks
-- Run this AFTER creating the tasks table (022_create_tasks_table.sql)

-- Clear existing tasks (for re-seeding)
DELETE FROM public.tasks WHERE stream IS NOT NULL;

-- Stream: Questionnaire (5 tasks)
INSERT INTO public.tasks (title, description, owner_name, status, priority, expected_end_date, stream, depends_on)
VALUES
  ('Review current 17 questions', 'Workshop to review existing questionnaire questions against needs', 'Bertrand', 'pending', 'high', '2026-01-20', 'questionnaire', '{}'),
  ('Create Excel with final question list', 'Document all questions, answer options, and scoring weights', 'Bertrand', 'pending', 'high', '2026-01-22', 'questionnaire', '{}'),
  ('Document conditional questions (LDC)', 'Specify which questions unlock only for candidates with Lettre de Cadrage', 'Bertrand', 'pending', 'medium', '2026-01-22', 'questionnaire', '{}'),
  ('Implement question changes', 'Update platform questionnaire based on Excel spec', 'Ivan', 'pending', 'high', '2026-01-23', 'questionnaire', '{}'),
  ('Update scoring weights if needed', 'Adjust Tier 1 scoring algorithm based on new weights', 'Ivan', 'pending', 'medium', '2026-01-23', 'questionnaire', '{}');

-- Stream: Emails (4 tasks)
INSERT INTO public.tasks (title, description, owner_name, status, priority, expected_end_date, stream, depends_on)
VALUES
  ('Test manual email sending', 'Test the platform email sending functionality from the Emails page', 'Bertrand', 'pending', 'high', '2026-01-20', 'emails', '{}'),
  ('List all email scenarios needed', 'Document all trigger points and corresponding email messages', 'Bertrand', 'pending', 'medium', '2026-01-20', 'emails', '{}'),
  ('Write email texts (French)', 'Create French email content for all scenarios', 'Bertrand', 'pending', 'high', '2026-01-22', 'emails', '{}'),
  ('Adjust templates in codebase', 'Update email templates based on provided text', 'Ivan', 'pending', 'medium', '2026-01-23', 'emails', '{}');

-- Stream: Branding (6 tasks)
INSERT INTO public.tasks (title, description, owner_name, status, priority, expected_end_date, stream, depends_on)
VALUES
  ('Provide logo file (PNG/SVG)', 'Share high-resolution logo for intake form branding', 'Bertrand', 'pending', 'high', '2026-01-20', 'branding', '{}'),
  ('Decide on custom domain', 'Choose between subdomain (app.renew.fr) or new domain', 'Bertrand', 'pending', 'high', '2026-01-20', 'branding', '{}'),
  ('Configure DNS at registrar', 'Set up DNS records pointing to Vercel', 'Bertrand', 'pending', 'medium', '2026-01-21', 'branding', '{}'),
  ('Set up custom domain in Vercel', 'Configure Vercel to accept the custom domain', 'Ivan', 'pending', 'medium', '2026-01-21', 'branding', '{}'),
  ('Add logo to intake form', 'Integrate logo into the public intake form UI', 'Ivan', 'pending', 'medium', '2026-01-22', 'branding', '{}'),
  ('Review and approve final look', 'Final sign-off on intake form appearance', 'Bertrand', 'pending', 'high', '2026-01-22', 'branding', '{}');

-- Stream: Testing (3 tasks)
INSERT INTO public.tasks (title, description, owner_name, status, priority, expected_end_date, stream, depends_on)
VALUES
  ('Final testing of all flows', 'End-to-end testing of intake, scoring, and email flows', 'Ivan', 'pending', 'critical', '2026-01-23', 'testing', '{}'),
  ('Push production build', 'Deploy final production build to Vercel', 'Ivan', 'pending', 'critical', '2026-01-23', 'testing', '{}'),
  ('Verify build number reported', 'Confirm build version matches deployed application', 'Ivan', 'pending', 'high', '2026-01-23', 'testing', '{}');

-- Stream: Go-Live (4 tasks)
INSERT INTO public.tasks (title, description, owner_name, status, priority, expected_end_date, stream, depends_on)
VALUES
  ('Test complete intake flow', 'Founders test the full candidate submission process', 'Bertrand', 'pending', 'critical', '2026-01-23', 'go_live', '{}'),
  ('Test email sending', 'Verify emails arrive correctly from live platform', 'Bertrand', 'pending', 'high', '2026-01-23', 'go_live', '{}'),
  ('Update website/LinkedIn links', 'Replace old Flatchr links with new intake form URL', 'Bertrand', 'pending', 'high', '2026-01-23', 'go_live', '{}'),
  ('First real candidate processed', 'Process first real repreneur through the new system', 'Bertrand', 'pending', 'critical', '2026-01-24', 'go_live', '{}');

-- Now update dependencies using task IDs
-- We need to do this in a second pass since we need the generated UUIDs

-- Get task IDs for dependency setup
DO $$
DECLARE
  q_review_id UUID;
  q_excel_id UUID;
  q_ldc_id UUID;
  q_implement_id UUID;

  e_test_id UUID;
  e_list_id UUID;
  e_write_id UUID;

  b_logo_id UUID;
  b_domain_id UUID;
  b_dns_id UUID;
  b_vercel_id UUID;
  b_add_logo_id UUID;

  t_test_id UUID;
  t_build_id UUID;
BEGIN
  -- Get questionnaire task IDs
  SELECT id INTO q_review_id FROM public.tasks WHERE title = 'Review current 17 questions' LIMIT 1;
  SELECT id INTO q_excel_id FROM public.tasks WHERE title = 'Create Excel with final question list' LIMIT 1;
  SELECT id INTO q_ldc_id FROM public.tasks WHERE title = 'Document conditional questions (LDC)' LIMIT 1;
  SELECT id INTO q_implement_id FROM public.tasks WHERE title = 'Implement question changes' LIMIT 1;

  -- Get email task IDs
  SELECT id INTO e_test_id FROM public.tasks WHERE title = 'Test manual email sending' LIMIT 1;
  SELECT id INTO e_list_id FROM public.tasks WHERE title = 'List all email scenarios needed' LIMIT 1;
  SELECT id INTO e_write_id FROM public.tasks WHERE title = 'Write email texts (French)' LIMIT 1;

  -- Get branding task IDs
  SELECT id INTO b_logo_id FROM public.tasks WHERE title = 'Provide logo file (PNG/SVG)' LIMIT 1;
  SELECT id INTO b_domain_id FROM public.tasks WHERE title = 'Decide on custom domain' LIMIT 1;
  SELECT id INTO b_dns_id FROM public.tasks WHERE title = 'Configure DNS at registrar' LIMIT 1;
  SELECT id INTO b_vercel_id FROM public.tasks WHERE title = 'Set up custom domain in Vercel' LIMIT 1;
  SELECT id INTO b_add_logo_id FROM public.tasks WHERE title = 'Add logo to intake form' LIMIT 1;

  -- Get testing task IDs
  SELECT id INTO t_test_id FROM public.tasks WHERE title = 'Final testing of all flows' LIMIT 1;
  SELECT id INTO t_build_id FROM public.tasks WHERE title = 'Push production build' LIMIT 1;

  -- Set questionnaire dependencies
  UPDATE public.tasks SET depends_on = ARRAY[q_review_id] WHERE title = 'Create Excel with final question list';
  UPDATE public.tasks SET depends_on = ARRAY[q_excel_id, q_ldc_id] WHERE title = 'Implement question changes';
  UPDATE public.tasks SET depends_on = ARRAY[q_implement_id] WHERE title = 'Update scoring weights if needed';

  -- Set email dependencies
  UPDATE public.tasks SET depends_on = ARRAY[e_list_id] WHERE title = 'Write email texts (French)';
  UPDATE public.tasks SET depends_on = ARRAY[e_write_id] WHERE title = 'Adjust templates in codebase';

  -- Set branding dependencies
  UPDATE public.tasks SET depends_on = ARRAY[b_domain_id] WHERE title = 'Configure DNS at registrar';
  UPDATE public.tasks SET depends_on = ARRAY[b_dns_id] WHERE title = 'Set up custom domain in Vercel';
  UPDATE public.tasks SET depends_on = ARRAY[b_logo_id] WHERE title = 'Add logo to intake form';
  UPDATE public.tasks SET depends_on = ARRAY[b_add_logo_id, b_vercel_id] WHERE title = 'Review and approve final look';

  -- Set testing dependencies
  UPDATE public.tasks SET depends_on = ARRAY[t_test_id] WHERE title = 'Push production build';
  UPDATE public.tasks SET depends_on = ARRAY[t_build_id] WHERE title = 'Verify build number reported';

  -- Set go-live dependencies (depends on testing completion)
  UPDATE public.tasks SET depends_on = ARRAY[t_build_id] WHERE title = 'Test complete intake flow';
  UPDATE public.tasks SET depends_on = ARRAY[t_build_id] WHERE title = 'Test email sending';
  UPDATE public.tasks SET depends_on = ARRAY[t_build_id] WHERE title = 'Update website/LinkedIn links';
END $$;
