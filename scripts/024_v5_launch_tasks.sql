-- V5 Launch Plan Task Consolidation
-- This migration clears all existing tasks and populates with V5 launch plan tasks
-- Run date: 2026-01-18

-- Step 1: Drop existing CHECK constraint and add new one with V5 streams
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_stream_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_stream_check
  CHECK (stream IN ('questionnaire', 'email', 'domain', 'implementation', 'testing', 'launch'));

-- Step 2: Clear all existing tasks
DELETE FROM public.tasks;

-- Step 3: Insert V5 Launch Plan tasks

-- Stream: questionnaire (Week 1 - Due Jan 22-24)
INSERT INTO public.tasks (title, description, owner_name, status, expected_end_date, stream) VALUES
('Deliver final questionnaire spec (Notion)', 'Complete the questionnaire specification in Notion with all questions, options, and scoring weights', 'Bertrand + Amelie', 'pending', '2026-01-22', 'questionnaire'),
('Validate scoring weights', 'Review and confirm the Tier 1 scoring weights for each questionnaire question', 'Bertrand + Amelie', 'pending', '2026-01-22', 'questionnaire'),
('LDC handling decision (conditional upload)', 'Decide how to handle Lettre de Cadrage - make upload conditional based on journey stage', 'Bertrand + Amelie', 'pending', '2026-01-22', 'questionnaire'),
('Confirm journey stage names', 'Finalize the names for each journey stage (Explorer, Learner, Ready, Serial Acquirer)', 'Bertrand', 'pending', '2026-01-24', 'questionnaire');

-- Stream: email (Week 2 - Due Jan 31)
INSERT INTO public.tasks (title, description, owner_name, status, expected_end_date, stream) VALUES
('Draft welcome email template', 'Create the welcome email template sent after intake form submission', 'Bertrand + Amelie', 'pending', '2026-01-31', 'email'),
('Draft qualification email', 'Create the email template sent when a lead is qualified (Tier 2 stars assigned)', 'Bertrand + Amelie', 'pending', '2026-01-31', 'email'),
('Draft interview invitation email', 'Create the email template inviting qualified repreneurs to an interview', 'Bertrand + Amelie', 'pending', '2026-01-31', 'email'),
('Draft offer proposal email', 'Create the email template for sending offer proposals to clients', 'Bertrand + Amelie', 'pending', '2026-01-31', 'email'),
('Draft follow-up reminder email', 'Create the email template for follow-up reminders to inactive leads', 'Bertrand + Amelie', 'pending', '2026-01-31', 'email');

-- Stream: domain (Week 2 - Due Jan 27-31)
INSERT INTO public.tasks (title, description, owner_name, status, expected_end_date, stream) VALUES
('Provide DNS access for app.re-new.team', 'Grant DNS access to configure the custom domain for the platform', 'Bertrand', 'pending', '2026-01-27', 'domain'),
('Export Flatchr CSV', 'Export all repreneur data from Flatchr in CSV format for import', 'Bertrand', 'pending', '2026-01-31', 'domain');

-- Stream: implementation (Week 2 - Ivan)
INSERT INTO public.tasks (title, description, owner_name, status, expected_end_date, stream) VALUES
('Implement questionnaire from Notion spec', 'Build the questionnaire based on the final Notion specification', 'Ivan', 'pending', '2026-01-29', 'implementation'),
('Configure app.re-new.team domain', 'Set up the custom domain in Vercel and configure DNS', 'Ivan', 'pending', '2026-01-31', 'implementation'),
('Implement welcome email automation', 'Connect welcome email template to intake form submission trigger', 'Ivan', 'pending', '2026-01-31', 'implementation');

-- Stream: testing (Week 3 - Feb 3-7)
INSERT INTO public.tasks (title, description, owner_name, status, expected_end_date, stream) VALUES
('Import Flatchr historical data', 'Import the Flatchr CSV export into the Re-New platform', 'Ivan', 'pending', '2026-02-03', 'testing'),
('Test intake form usability', 'Complete user testing of the public intake form flow', 'Bertrand + Amelie', 'pending', '2026-02-05', 'testing'),
('Verify email automation', 'Test all email templates are sent correctly at the right triggers', 'Ivan', 'pending', '2026-02-05', 'testing'),
('Review journey stages', 'Validate the journey stage progression works as expected', 'All', 'pending', '2026-02-06', 'testing'),
('Validate notes/activity features', 'Test notes and activity tracking functionality', 'All', 'pending', '2026-02-06', 'testing'),
('Fix all reported issues', 'Resolve all bugs and issues found during testing', 'Ivan', 'pending', '2026-02-07', 'testing');

-- Stream: launch (Feb 7-10)
INSERT INTO public.tasks (title, description, owner_name, status, expected_end_date, stream) VALUES
('Final sign-off from Bertrand', 'Get final approval from Bertrand before go-live', 'Bertrand', 'pending', '2026-02-07', 'launch'),
('GO-LIVE: Public intake form', 'Launch the public intake form and begin accepting new repreneurs', 'All', 'pending', '2026-02-10', 'launch');

-- Verify: Count tasks by stream
-- SELECT stream, COUNT(*) FROM public.tasks GROUP BY stream ORDER BY stream;
