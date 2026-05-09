-- Seed the 3 pre-defined offer packages
-- These are the core consulting packages offered by Re-New

-- Clear existing offers (if any) before seeding
-- CAUTION: Only run this in development or before first production setup
-- DELETE FROM public.offers;

-- Insert the three core packages
INSERT INTO public.offers (name, description, price, duration_days, acceptance_deadline_days, includes_hours, includes_resources, is_active)
VALUES
  (
    'Starter Pack',
    'For less mature candidates to start their acquisition search. Includes initial coaching sessions, target identification methodology, and basic due diligence framework.',
    2500.00,
    42, -- 6 weeks
    14, -- 2 weeks to accept
    10, -- 10 hours of coaching
    true,
    true
  ),
  (
    'Deal Flow',
    'For candidates actively looking. Includes curation of qualified targets, introductions to business owners, deal sourcing support, and negotiation guidance. Pricing varies by target Enterprise Value.',
    5000.00, -- Base price, can be adjusted per deal
    365, -- 12 months
    21, -- 3 weeks to accept
    20, -- 20 hours included
    true,
    true
  ),
  (
    'Sparring Partner',
    'Subscription-based ongoing support. Monthly coaching sessions, deal review, negotiation support, and strategic advice throughout the acquisition process.',
    3600.00, -- 600 EUR/month x 6 months
    180, -- 6 months
    14, -- 2 weeks to accept
    12, -- 2 hours per month x 6
    true,
    true
  )
ON CONFLICT DO NOTHING;

-- Verify the inserts
SELECT id, name, price, duration_days, includes_hours FROM public.offers WHERE is_active = true;
