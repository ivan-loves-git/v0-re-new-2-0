-- Migration: Seed Tier 1 evaluation criteria
-- Run this in Supabase SQL Editor AFTER 014_create_evaluation_criteria_table.sql
-- Data extracted from lib/utils/tier1-scoring.ts

-- =============================================
-- Clear existing Tier 1 data (if re-running)
-- =============================================
DELETE FROM public.evaluation_criteria WHERE tier = 'tier1';

-- =============================================
-- Q1: Employment Status (0-10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q1_employment_status', 'Statut professionnel actuel', 1, 'sans_emploi', 'Sans emploi', 10, 1),
  ('tier1', 'q1_employment_status', 'Statut professionnel actuel', 1, 'transition', 'En transition professionnelle', 10, 2),
  ('tier1', 'q1_employment_status', 'Statut professionnel actuel', 1, 'independant', 'Travailleur indépendant', 7, 3),
  ('tier1', 'q1_employment_status', 'Statut professionnel actuel', 1, 'temps_plein', 'Employé à temps plein', 5, 4),
  ('tier1', 'q1_employment_status', 'Statut professionnel actuel', 1, 'temps_partiel', 'Employé à temps partiel', 5, 5),
  ('tier1', 'q1_employment_status', 'Statut professionnel actuel', 1, 'autre', 'Autre', 3, 6);

-- =============================================
-- Q2: Years of Experience (0-10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q2_years_experience', 'Années d''expérience professionnelle', 2, '20_plus', '>20 ans', 10, 1),
  ('tier1', 'q2_years_experience', 'Années d''expérience professionnelle', 2, '16_20', '16 à 20 ans', 7.5, 2),
  ('tier1', 'q2_years_experience', 'Années d''expérience professionnelle', 2, '11_15', '11 à 15 ans', 5, 3),
  ('tier1', 'q2_years_experience', 'Années d''expérience professionnelle', 2, 'less_10', '<10 ans', 0, 4);

-- =============================================
-- Q3: Industry Sectors (calculated: 3+ sectors = 5 pts, else 3 pts)
-- This is a multi-select, shown as informational
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q3_industry_sectors', 'Secteurs d''expérience', 3, '_info', '3+ secteurs = 5 pts, sinon 3 pts', NULL, 1);

-- =============================================
-- Q4: Has M&A Experience (NOT SCORED - informational only)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q4_has_ma_experience', 'Expérience en fusions-acquisitions', 4, '_info', 'Question contextuelle (non notée)', NULL, 1);

-- =============================================
-- Q5: Team Size Managed (0-10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q5_team_size', 'Taille d''équipe managée', 5, '50_plus', '>50 pers.', 10, 1),
  ('tier1', 'q5_team_size', 'Taille d''équipe managée', 5, '20_50', '20 à 50 pers.', 7.5, 2),
  ('tier1', 'q5_team_size', 'Taille d''équipe managée', 5, '11_20', '11 à 20 pers.', 0, 3),
  ('tier1', 'q5_team_size', 'Taille d''équipe managée', 5, 'less_10', '<10 pers.', 3, 4);

-- =============================================
-- Q6: Involved in M&A Transactions (0 or 10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q6_involved_in_ma', 'Impliqué dans des transactions M&A', 6, 'true', 'Oui', 10, 1),
  ('tier1', 'q6_involved_in_ma', 'Impliqué dans des transactions M&A', 6, 'false', 'Non', 0, 2);

-- =============================================
-- Q7: M&A Details (NOT SCORED - free text)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q7_ma_details', 'Détails de l''expérience M&A', 7, '_info', 'Champ libre (non noté)', NULL, 1);

-- =============================================
-- Q8: Executive Roles (0-6 points, complex scoring)
-- C-level = 4 pts, + 2 pts bonus if multiple roles
-- Division Director = 4 pts, Other = 2 pts
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'ceo', 'CEO/Directeur Général', 4, 1),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'coo', 'COO/Directeur des Opérations', 4, 2),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'cfo', 'CFO/Directeur Financier', 4, 3),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'cco', 'CCO/Directeur Commercial', 4, 4),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'cto', 'CTO/CIO/Directeur des SI', 4, 5),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'chro', 'CHRO/Directeur RH', 4, 6),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'division_director', 'Directeur de Division/BU', 4, 7),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'other', 'Autres', 2, 8),
  ('tier1', 'q8_executive_roles', 'Postes de direction occupés', 8, 'none', 'Aucun', 0, 9);

-- =============================================
-- Q9: Board Experience (0 or 10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q9_board_experience', 'Expérience au sein d''un conseil d''administration', 9, 'true', 'Oui', 10, 1),
  ('tier1', 'q9_board_experience', 'Expérience au sein d''un conseil d''administration', 9, 'false', 'Non', 0, 2);

-- =============================================
-- Q10: Journey Stages (2-10 points, takes max score)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q10_journey_stages', 'Étape du parcours de reprise', 10, 'info_only', 'Recherche d''informations uniquement', 2, 1),
  ('tier1', 'q10_journey_stages', 'Étape du parcours de reprise', 10, 'first_contacts', 'Premiers contacts avec des acteurs de la reprise', 4, 2),
  ('tier1', 'q10_journey_stages', 'Étape du parcours de reprise', 10, 'training_done', 'Formation à la reprise effectuée', 6, 3),
  ('tier1', 'q10_journey_stages', 'Étape du parcours de reprise', 10, 'letter_of_intent', 'Lettre de cadrage (projet ou final)', 8, 4),
  ('tier1', 'q10_journey_stages', 'Étape du parcours de reprise', 10, 'target_search', 'Recherche de cibles', 8, 5),
  ('tier1', 'q10_journey_stages', 'Étape du parcours de reprise', 10, 'financing_defined', 'Financement défini (ou en cours)', 10, 6);

-- =============================================
-- Q11: Target Sectors (calculated: 3+ sectors = 5 pts, else 2 pts)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q11_target_sectors', 'Secteurs cibles', 11, '_info', '3+ secteurs = 5 pts, sinon 2 pts', NULL, 1);

-- =============================================
-- Q12: Has Identified Targets (0 or 10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q12_has_identified_targets', 'Cibles identifiées', 12, 'true', 'Oui', 10, 1),
  ('tier1', 'q12_has_identified_targets', 'Cibles identifiées', 12, 'false', 'Non', 0, 2);

-- =============================================
-- Q13: Target Details (NOT SCORED - free text)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q13_target_details', 'Détails des cibles', 13, '_info', 'Champ libre (non noté)', NULL, 1);

-- =============================================
-- Q14: Investment Capacity (0-10 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q14_investment_capacity', 'Capacité d''investissement', 14, '450_plus', '>450 K€', 10, 1),
  ('tier1', 'q14_investment_capacity', 'Capacité d''investissement', 14, '351_450', '351 K€ - 450 K€', 8, 2),
  ('tier1', 'q14_investment_capacity', 'Capacité d''investissement', 14, '251_350', '251 K€ - 350 K€', 6, 3),
  ('tier1', 'q14_investment_capacity', 'Capacité d''investissement', 14, '151_250', '151 K€ - 250 K€', 4, 4),
  ('tier1', 'q14_investment_capacity', 'Capacité d''investissement', 14, 'less_150', '<150 K€', 2, 5),
  ('tier1', 'q14_investment_capacity', 'Capacité d''investissement', 14, 'tbd', 'En cours d''évaluation / à définir', 0, 6);

-- =============================================
-- Q15: Funding Status (1-3 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q15_funding_status', 'Statut du financement', 15, 'secured', 'Déjà bouclé', 3, 1),
  ('tier1', 'q15_funding_status', 'Statut du financement', 15, 'in_progress', 'En cours de validation', 1, 2);

-- =============================================
-- Q16: Network/Training (0-4 points)
-- Any network = 2 pts, CRA = +2 bonus
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q16_network_training', 'Réseau/Formation', 16, 'cra', 'C.R.A.', 4, 1),
  ('tier1', 'q16_network_training', 'Réseau/Formation', 16, 'cci', 'CCI', 2, 2),
  ('tier1', 'q16_network_training', 'Réseau/Formation', 16, 'other', 'Autres', 2, 3),
  ('tier1', 'q16_network_training', 'Réseau/Formation', 16, 'none', 'Non, aucune', 0, 4);

-- =============================================
-- Q17: Open to Co-acquisition (0 or 5 points)
-- =============================================
INSERT INTO public.evaluation_criteria (tier, question_key, question_label, question_order, option_value, option_label, option_score, option_order) VALUES
  ('tier1', 'q17_open_to_co_acquisition', 'Ouvert à la co-acquisition', 17, 'true', 'Oui', 5, 1),
  ('tier1', 'q17_open_to_co_acquisition', 'Ouvert à la co-acquisition', 17, 'false', 'Non', 0, 2);

-- =============================================
-- Verify the data
-- =============================================
-- SELECT question_key, question_label, COUNT(*) as options_count
-- FROM public.evaluation_criteria
-- WHERE tier = 'tier1'
-- GROUP BY question_key, question_label, question_order
-- ORDER BY question_order;
