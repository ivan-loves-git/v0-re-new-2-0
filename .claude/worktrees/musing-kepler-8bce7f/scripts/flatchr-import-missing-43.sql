-- Missing Records Import Script
-- Generated: 2026-01-11T08:20:03.005644
-- Records to add: 43

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'zj8Md60ZwgA9YZ70', 'Amelie', 'Lyon', 'imported-zj8Md60ZwgA9YZ70@placeholder.invalid', 'qualified', 31.5, 2,
  'flatchr_import', '2025-09-22T06:42:13.334Z',
  'Travailleur indépendant', '16 à 20 ans', '["scientifiques & techniques"]'::jsonb,
  TRUE, '11 à 20 pers.', FALSE, NULL,
  '["CHRO/Directeur - Directrice des ressources humaines"]'::jsonb, FALSE, '["Premiers contacts avec des acteurs de la reprise"]'::jsonb,
  '["Spectacles & Loisirs"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'yObP9OgxLRP91ZYB', 'Ake', 'Aamakon205@gmail.com', 'imported-yObP9OgxLRP91ZYB@placeholder.invalid', 'qualified', 47.0, 3,
  'flatchr_import', '2025-09-23T13:44:23.377Z',
  'Travailleur indépendant', '11 à 15 ans', '["Gestion des entreprises"]'::jsonb,
  TRUE, '<10 pers.', TRUE, 'J''ai participé  au diagnostic et a la mise en place et la présentation d''un plan développement  pour le rachat de deux structures',
  '["CCO/Directeur - Directrice commercial"]'::jsonb, TRUE, '["Formation à la reprise effectuée", "Recherche d''informations uniquement"]'::jsonb,
  '["Gestion des entreprises"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '86rjpg7rJ6DpE17e', 'Strategie', 'De rupture', 'imported-86rjpg7rJ6DpE17e@placeholder.invalid', 'qualified', 47.0, 3,
  'flatchr_import', '2025-09-30T07:18:20.221Z',
  'Employé à temps partiel', '>20 ans', '["Santé & Assistance sociale"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'Chez Orange et Saint-Gobain Achat puis intégration de PME.,',
  '["Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Premiers contacts avec des acteurs de la reprise"]'::jsonb,
  '["Services publics"]'::jsonb, TRUE, '50 ME',
  '>450 K€', 'En  cours de validation', '["C.R.A."]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'Lm5NdDwoqgApAGbZ', 'Ismail', 'Hjjoubi', 'imported-Lm5NdDwoqgApAGbZ@placeholder.invalid', 'qualified', 28.0, 1,
  'flatchr_import', '2025-10-01T13:15:11.824Z',
  'Employé à temps plein', '<10 ans', '["Services professionnels"]'::jsonb,
  TRUE, '<10 pers.', FALSE, NULL,
  '["Autres"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Transport & entreposage"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'AONxpvA08DX9Pg4Q', 'Qeirthyane', 'Many', 'imported-AONxpvA08DX9Pg4Q@placeholder.invalid', 'qualified', 46.0, 3,
  'flatchr_import', '2025-10-02T15:26:08.868Z',
  'Sans emploi', '<10 ans', '["Gestion des entreprises", "Administration publique & gouvernement", "Immobilier & location", "Commerce de gros", "Finance & Assurances"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, 'J''ai vendu mes deux entreprises à mes co-associés.',
  '["CEO/Directeur - Directrice général"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Finance & Assurances", "Gestion des entreprises", "Immobilier & location", "Administration publique & gouvernement"]'::jsonb, FALSE, NULL,
  '<150 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'EZBvp5z3ayXdMoVm', 'Arnaud', 'Duffort', 'imported-EZBvp5z3ayXdMoVm@placeholder.invalid', 'qualified', 70.0, 5,
  'flatchr_import', '2025-10-02T16:01:31.032Z',
  'Autre', '>20 ans', '["Gestion des entreprises", "Immobilier & location"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'J’ai au cours de ma carrière acquis des entreprises en retournement, des entreprises en phase de transmission tout comme des entreprises pour des raisons de croissance externe simple.',
  '["CEO/Directeur - Directrice général"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Commerce de détail", "Immobilier & location", "Gestion des entreprises", "Hébergement & Restauration", "Commerce de gros"]'::jsonb, FALSE, NULL,
  '>450 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'KJ0MpzwEDeqdXNgx', 'Antoine', 'Gamberini', 'imported-KJ0MpzwEDeqdXNgx@placeholder.invalid', 'qualified', 54.0, 4,
  'flatchr_import', '2025-10-04T21:37:11.124Z',
  'En transition professionnelle', '11 à 15 ans', '["Services professionnels", "Autres services"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Premiers contacts avec des acteurs de la reprise"]'::jsonb,
  '["Hébergement & Restauration", "Services administratifs & de soutien", "Arts", "Spectacles & Loisirs", "Services éducatifs", "Information & Médias", "Gestion des entreprises", "Industrie manufacturière", "Autres services", "Services professionnels", "Commerce de détail", "Immobilier & location"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '8oWlpG8ey6Qd63O1', 'Mathieu', 'Figueres', 'imported-8oWlpG8ey6Qd63O1@placeholder.invalid', 'qualified', 37.0, 2,
  'flatchr_import', '2025-10-05T14:03:09.788Z',
  'Employé à temps plein', '11 à 15 ans', '["Commerce de détail", "Commerce de gros"]'::jsonb,
  TRUE, '<10 pers.', FALSE, NULL,
  '["CCO/Directeur - Directrice commercial"]'::jsonb, FALSE, '["Formation à la reprise effectuée", "Lettre de cadrage (projet ou final)", "Premiers contacts avec des acteurs de la reprise", "Recherche de cibles"]'::jsonb,
  '["Commerce de détail", "Commerce de gros", "Industrie manufacturière"]'::jsonb, FALSE, NULL,
  '<150 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '8q3Bp4lQeJgp0RMg', 'Aziah', 'Rojehoussen', 'imported-8q3Bp4lQeJgp0RMg@placeholder.invalid', 'qualified', 56.0, 4,
  'flatchr_import', '2025-10-05T21:31:15.169Z',
  'Sans emploi', '11 à 15 ans', '["Finance & Assurances", "Gestion des entreprises", "Autres services", "Construction", "Industrie manufacturière", "Commerce de détail", "Administration publique & gouvernement"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, 'Accompagner un entrepreneur dans la cession de son entreprise - transaction de 3M€',
  '["CFO/Directeur - Directrice financier"]'::jsonb, TRUE, '["Recherche d''informations uniquement", "Premiers contacts avec des acteurs de la reprise"]'::jsonb,
  '["Hébergement & Restauration", "Finance & Assurances", "Gestion des entreprises", "Commerce de gros", "Services professionnels", "Industrie manufacturière", "Construction", "Agriculture", "Sylviculture"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'zbPjpoaB22enY51y', 'Frederic', 'Canesso', 'imported-zbPjpoaB22enY51y@placeholder.invalid', 'qualified', 35.0, 2,
  'flatchr_import', '2025-10-05T21:45:38.322Z',
  'En transition professionnelle', '<10 ans', '["Hébergement & Restauration", "Finance & Assurances", "Industrie manufacturière"]'::jsonb,
  TRUE, '<10 pers.', FALSE, NULL,
  '["Aucun"]'::jsonb, FALSE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Hébergement & Restauration", "Industrie manufacturière"]'::jsonb, FALSE, NULL,
  '251 K€ - 350 K€', 'Déjà bouclé', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'xy5JpxrBX8vnz7lV', 'Zahi', 'Kattar', 'imported-xy5JpxrBX8vnz7lV@placeholder.invalid', 'qualified', 35.0, 2,
  'flatchr_import', '2025-10-06T08:21:48.201Z',
  'Employé à temps plein', '>20 ans', '["Extraction minière"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'acquisition de plusieurs sociétés de services pétrolier et de fabrication d''equipements aux États Unis,',
  '["CEO/Directeur - Directrice général"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["scientifiques & techniques"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'Qayv9LL6mab96LXE', 'Jeimila', 'Six donty', 'imported-Qayv9LL6mab96LXE@placeholder.invalid', 'qualified', 44.0, 3,
  'flatchr_import', '2025-10-06T13:51:46.176Z',
  'Travailleur indépendant', '11 à 15 ans', '["Hébergement & Restauration", "Information & Médias", "Gestion des entreprises", "Services professionnels"]'::jsonb,
  TRUE, '20 à 50 pers.', TRUE, 'Ma famille à Madagascar a plusieurs entreprises. En 2020, au décès de mon père, j''ai organiser la transmission : légal (changement des statuts), organisationnel (nomination des gérants, coordination avec les 4 ayants droits), finance (valorisation, liquidation). J''ai également repris et transformé l''une d''entre elles : https://news.mongabay.com/2024/02/from-exporting-coral-to-restoring-reefs-a-madagascar-startup-rethinks-business/',
  '["CEO/Directeur - Directrice général"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Hébergement & Restauration", "Spectacles & Loisirs"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'GYLqn10WAPOdmE0y', 'Gonzague', 'De torcy', 'imported-GYLqn10WAPOdmE0y@placeholder.invalid', 'qualified', 36.0, 2,
  'flatchr_import', '2025-10-06T15:35:47.407Z',
  'Sans emploi', '16 à 20 ans', '["Industrie manufacturière"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'Création',
  '["CCO/Directeur - Directrice commercial"]'::jsonb, FALSE, '["Formation à la reprise effectuée"]'::jsonb,
  '["Industrie manufacturière"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'En  cours de validation', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'ENkKd806ZOmd3xYG', 'Arnaud', 'Laurent-tenaille', 'imported-ENkKd806ZOmd3xYG@placeholder.invalid', 'qualified', 37.0, 2,
  'flatchr_import', '2025-10-06T18:48:59.716Z',
  'Employé à temps plein', '11 à 15 ans', '["Immobilier & location"]'::jsonb,
  TRUE, '<10 pers.', FALSE, NULL,
  '["Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Immobilier & location"]'::jsonb, FALSE, 'CA entre 500 et 3 M d''euros
inférieur à 10 employés',
  '<150 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'mQNJ9W0gzDJp5LwD', 'Bertrand', 'De poly', 'imported-mQNJ9W0gzDJp5LwD@placeholder.invalid', 'qualified', 58.0, 4,
  'flatchr_import', '2025-10-08T07:31:14.118Z',
  'Travailleur indépendant', '>20 ans', '["scientifiques & techniques", "Gestion des entreprises", "Santé & Assistance sociale", "Services professionnels"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["CEO/Directeur - Directrice général"]'::jsonb, TRUE, '["Recherche d''informations uniquement", "Premiers contacts avec des acteurs de la reprise", "Formation à la reprise effectuée"]'::jsonb,
  '["scientifiques & techniques", "Services professionnels", "Industrie manufacturière", "Gestion des entreprises", "Santé & Assistance sociale"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'YJA39J4GQBYdlNQw', 'Pascal', 'Turcot', 'imported-YJA39J4GQBYdlNQw@placeholder.invalid', 'qualified', 51.0, 4,
  'flatchr_import', '2025-10-08T10:19:18.537Z',
  'En transition professionnelle', '>20 ans', '["Santé & Assistance sociale", "Industrie manufacturière", "scientifiques & techniques"]'::jsonb,
  TRUE, '11 à 20 pers.', FALSE, NULL,
  '["CCO/Directeur - Directrice commercial"]'::jsonb, FALSE, '["Premiers contacts avec des acteurs de la reprise", "Lettre de cadrage (projet ou final)", "Formation à la reprise effectuée", "Recherche de cibles"]'::jsonb,
  '["Santé & Assistance sociale", "Industrie manufacturière", "scientifiques & techniques"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'Déjà bouclé', '["Autres"]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'zbPjpoaBPG3nY51y', 'Jeremy', 'Ballet', 'imported-zbPjpoaBPG3nY51y@placeholder.invalid', 'qualified', 75.0, 5,
  'flatchr_import', '2025-10-08T16:01:50.983Z',
  'Travailleur indépendant', '11 à 15 ans', '["Services administratifs & de soutien", "Finance & Assurances", "Gestion des entreprises", "Services professionnels", "scientifiques & techniques", "Santé & Assistance sociale", "Autres services"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, '- Multiples opérations en capital réalisées lors d''une expérience en fonds d''investissement (fonds de capital développement accompagnant des PMEs réalisant 5 à 50 m€ de CA) + Accompagnement sur du build-up pour certaines de mes participations 
- Réalisation d''acquisitions (en tant que CFO) pour une société dans la Tech Pharma - conduite et pilotage des due diligences, négociations financières et juridiques avec les cédants - 2 entreprises en Allemagne & UK (+ de 60 personnes)',
  '["CEO/Directeur - Directrice général", "CFO/Directeur - Directrice financier", "CHRO/Directeur - Directrice des ressources humaines"]'::jsonb, TRUE, '["Recherche de cibles"]'::jsonb,
  '["Autres services", "Services professionnels", "Services administratifs & de soutien", "Gestion des entreprises"]'::jsonb, TRUE, 'Plusieurs sociétés dans divers secteurs des services aux entreprises (Nettoyage professionnel notamment). 
Exemple de taille d''une des cibles identifiées : 3 m€ CA / 50+ ETPs / Valo aux alentours des 1,5 m€
Les tailles des cibles se situent entre 1 et 5 m€ CA',
  '>450 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '86rjpg7XPK6pE17e', 'Félix', 'Sassiat', 'imported-86rjpg7XPK6pE17e@placeholder.invalid', 'qualified', 47.0, 3,
  'flatchr_import', '2025-10-08T19:55:52.203Z',
  'Travailleur indépendant', '11 à 15 ans', '["Gestion des entreprises", "Industrie manufacturière", "Services professionnels", "Transport & entreposage", "Commerce de détail"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["COO/Directeur - Directrice des opérations", "Division/BU Director/Directeur - Directrice de centre de profits", "Autres"]'::jsonb, FALSE, '["Recherche d''informations uniquement", "Premiers contacts avec des acteurs de la reprise", "Recherche de cibles"]'::jsonb,
  '["Hébergement & Restauration", "Gestion des entreprises", "Industrie manufacturière", "Commerce de détail", "Transport & entreposage", "Commerce de gros"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '56Rb9Abx18GpoNZQ', 'Selim', 'Bellehchili', 'imported-56Rb9Abx18GpoNZQ@placeholder.invalid', 'qualified', 35.0, 2,
  'flatchr_import', '2025-10-09T09:13:08.722Z',
  'Travailleur indépendant', '11 à 15 ans', '["Hébergement & Restauration", "Immobilier & location", "Spectacles & Loisirs"]'::jsonb,
  TRUE, '11 à 20 pers.', FALSE, NULL,
  '["CEO/Directeur - Directrice général", "COO/Directeur - Directrice des opérations"]'::jsonb, FALSE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Spectacles & Loisirs", "Gestion des entreprises", "Autres services", "Services éducatifs", "Finance & Assurances"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '5aMxpQANqo7pGZ2O', 'Aymeric', 'Mautin', 'imported-5aMxpQANqo7pGZ2O@placeholder.invalid', 'qualified', 75.0, 5,
  'flatchr_import', '2025-10-09T14:54:02.326Z',
  'Travailleur indépendant', '>20 ans', '["Industrie manufacturière", "Services professionnels", "Commerce de gros"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'M&A Director chez Saint Gobain et chanel
Acquisition d’une enterprise pour moi: les mouettes vertes',
  '["CEO/Directeur - Directrice général", "CFO/Directeur - Directrice financier"]'::jsonb, TRUE, '["Formation à la reprise effectuée"]'::jsonb,
  '["Services professionnels", "Finance & Assurances", "Spectacles & Loisirs", "Arts"]'::jsonb, FALSE, NULL,
  '>450 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'yObP9OgvB7791ZYB', 'Albin', 'Juliard', 'imported-yObP9OgvB7791ZYB@placeholder.invalid', 'qualified', 62.0, 5,
  'flatchr_import', '2025-10-09T19:01:28.052Z',
  'Sans emploi', '11 à 15 ans', '["Commerce de détail", "Gestion des entreprises", "Hébergement & Restauration", "Agriculture"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["CEO/Directeur - Directrice général", "COO/Directeur - Directrice des opérations", "CCO/Directeur - Directrice commercial", "Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Recherche d''informations uniquement", "Recherche de cibles"]'::jsonb,
  '["Hébergement & Restauration", "Agriculture", "Gestion des entreprises", "Industrie manufacturière", "Autres services", "Services professionnels", "Commerce de détail", "Commerce de gros"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'xy5Jpxr46OEnz7lV', 'Rochdi', 'Akbi', 'imported-xy5Jpxr46OEnz7lV@placeholder.invalid', 'qualified', 47.0, 3,
  'flatchr_import', '2025-10-10T09:14:16.029Z',
  'Travailleur indépendant', '11 à 15 ans', '["Transport & entreposage"]'::jsonb,
  TRUE, '11 à 20 pers.', FALSE, NULL,
  '["CEO/Directeur - Directrice général"]'::jsonb, FALSE, '["Premiers contacts avec des acteurs de la reprise", "Formation à la reprise effectuée", "Lettre de cadrage (projet ou final)", "Financement défini (ou en cours)", "Recherche de cibles"]'::jsonb,
  '["Transport & entreposage", "Construction"]'::jsonb, TRUE, 'CA à partir de 2M€, à partir de 10 personnes, à partir de 800k€.',
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Autres"]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'AONxpvAeAZk9Pg4Q', 'Antoine', 'Bordier', 'imported-AONxpvAeAZk9Pg4Q@placeholder.invalid', 'qualified', 59.0, 4,
  'flatchr_import', '2025-10-10T11:45:15.104Z',
  'Travailleur indépendant', '>20 ans', '["Information & Médias", "Gestion des entreprises", "Services professionnels"]'::jsonb,
  TRUE, '20 à 50 pers.', TRUE, 'Oui, j''ai été impliqué à plusieurs reprises dans ce processus. Soit pour mon propre compte - reprise d''entreprise dans le cadre d''une cession - soit dans le cadre d''un spin-off pour lequel j''étais le DAF.',
  '["CEO/Directeur - Directrice général", "CFO/Directeur - Directrice financier", "CCO/Directeur - Directrice commercial"]'::jsonb, TRUE, '["Recherche d''informations uniquement", "Recherche de cibles"]'::jsonb,
  '["Information & Médias", "Services professionnels"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["C.R.A.", "Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'EjyY9lE34jQpZl7o', 'Younes', 'Karim', 'imported-EjyY9lE34jQpZl7o@placeholder.invalid', 'qualified', 68.0, 5,
  'flatchr_import', '2025-10-11T10:08:28.495Z',
  'Employé à temps plein', '>20 ans', '["Gestion des entreprises", "Hébergement & Restauration", "Finance & Assurances", "Services professionnels", "scientifiques & techniques", "Immobilier & location", "Autres services", "Industrie manufacturière"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["COO/Directeur - Directrice des opérations", "CFO/Directeur - Directrice financier", "CTO/CIO/Directeur - Directrice des systèmes d''information", "Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Finance & Assurances", "Information & Médias", "Gestion des entreprises", "Industrie manufacturière", "Autres services", "Services professionnels", "Immobilier & location", "Commerce de détail", "Commerce de gros"]'::jsonb, FALSE, NULL,
  '>450 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '41QG9eOrPaPdK6Xe', 'Galdric', 'Donnezan', 'imported-41QG9eOrPaPdK6Xe@placeholder.invalid', 'qualified', 37.0, 2,
  'flatchr_import', '2025-10-11T11:55:23.025Z',
  'Employé à temps plein', '>20 ans', '["Gestion des entreprises"]'::jsonb,
  TRUE, '20 à 50 pers.', FALSE, NULL,
  '["CEO/Directeur - Directrice général", "CCO/Directeur - Directrice commercial"]'::jsonb, FALSE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Gestion des entreprises"]'::jsonb, FALSE, NULL,
  '351 K€ - 450 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'AbY1n7GgxVNnLgJN', 'Timothée', 'Rubino', 'imported-AbY1n7GgxVNnLgJN@placeholder.invalid', 'qualified', 58.0, 4,
  'flatchr_import', '2025-10-13T09:34:41.254Z',
  'Travailleur indépendant', '11 à 15 ans', '["Construction", "Finance & Assurances", "Gestion des entreprises", "Services professionnels", "Autres services"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, 'Oui, j’ai été directement impliqué dans plusieurs opérations de reprise et de transmission.
- Accompagnement de 4 reprises de PME dans le cadre d’Itera Innovation : analyse, valorisation, montage financier 
- Expertise acquise sur l’ensemble du processus : due diligence, business plan, négociation et intégration.',
  '["CEO/Directeur - Directrice général"]'::jsonb, FALSE, '["Formation à la reprise effectuée", "Premiers contacts avec des acteurs de la reprise", "Lettre de cadrage (projet ou final)", "Recherche de cibles", "Financement défini (ou en cours)"]'::jsonb,
  '["Hébergement & Restauration", "Spectacles & Loisirs", "Services professionnels", "Services éducatifs"]'::jsonb, TRUE, '2 a 5 Millions d''euros CA, EBE de 200 à 500Ke. 10 à 20 collaborateurs.',
  '<150 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'QorW9wPQQqkpyelR', 'Steven', 'Annonziata', 'imported-QorW9wPQQqkpyelR@placeholder.invalid', 'qualified', 49.5, 3,
  'flatchr_import', '2025-10-13T12:07:17.796Z',
  'En transition professionnelle', '16 à 20 ans', '["scientifiques & techniques", "Santé & Assistance sociale", "Spectacles & Loisirs"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["CEO/Directeur - Directrice général"]'::jsonb, FALSE, '["Recherche de cibles", "Formation à la reprise effectuée"]'::jsonb,
  '["Spectacles & Loisirs", "Services éducatifs", "Services professionnels"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'Déjà bouclé', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '8q3Bp4l7xyrp0RMg', 'Alxandre', 'Siboni', 'imported-8q3Bp4l7xyrp0RMg@placeholder.invalid', 'qualified', 68.5, 5,
  'flatchr_import', '2025-10-13T13:20:58.737Z',
  'Travailleur indépendant', '16 à 20 ans', '["Services administratifs & de soutien", "Services éducatifs", "Finance & Assurances", "Information & Médias", "Gestion des entreprises", "Services professionnels", "Commerce de détail"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, 'J’ai été directement impliqué dans plusieurs opérations de croissance externe, de levée de fonds et de cession d’entreprise à différents niveaux de responsabilité.
En tant que cofondateur et directeur financier de toucanBox, j’ai piloté l’ensemble du processus de cession de l’entreprise à un groupe stratégique (Sandbox Group): préparation de la documentation, coordination des audits, négociations avec les acquéreurs, structuration juridique et closing. J’ai également conduit plusieurs levées de fonds auprès de fonds de venture capital et négocié des financements non dilutifs.
En amont, chez Barclays en M&A, j’ai participé à de nombreuses opérations d’acquisition et de cession dans le secteur industriel, en particulier pour des ETI européennes, ce qui m’a donné une solide maîtrise des processus transactionnels (due diligence, modélisation, valorisation, structuration de deals).
Enfin, dans le cadre de mes missions récentes en tant que CFO freelance pour des PME, j’ai accompagné plusieurs fondateurs dans leur préparation à la transmission ou à la croissance externe, en structurant leur reporting, en organisant les données financières, et en les préparant aux exigences des investisseurs ou acquéreurs.
Ces expériences nourrissent aujourd’hui ma volonté de passer de l’accompagnement à l’engagement direct, en devenant moi-même repreneur opérateur.',
  '["CFO/Directeur - Directrice financier", "COO/Directeur - Directrice des opérations"]'::jsonb, FALSE, '["Formation à la reprise effectuée", "Premiers contacts avec des acteurs de la reprise", "Lettre de cadrage (projet ou final)", "Financement défini (ou en cours)", "Recherche de cibles"]'::jsonb,
  '["Services administratifs & de soutien", "Services éducatifs", "Information & Médias", "Gestion des entreprises", "Services professionnels", "Commerce de détail"]'::jsonb, TRUE, 'J’ai identifié et analysé plusieurs entreprises potentielles, principalement via le réseau CRA, des plateformes spécialisées ou des mises en relation directes. Certaines ont donné lieu à des échanges préliminaires avec les cédants ou leurs conseils, mais sans qu’un processus formel n’ait encore été engagé à ce stade.
Je cible des entreprises rentables, structurées, avec une équipe en place, idéalement dans les secteurs du bien-être, de l’éducation, des services à la personne, des solutions B2B pour TPE/PME.
En termes de taille, je suis ouvert à différents formats selon le contexte de financement:
- En reprise en solo, je vise des entreprises avec 1 à 5 M€ de chiffre d’affaires, 10 à 50 salariés, et une valorisation autour de 1 M€.
- Avec l’appui d’un fonds ou de partenaires financiers, je suis en capacité de viser des cibles plus importantes si le projet le justifie.
Cette flexibilité me permet d’adapter ma recherche au potentiel de structuration, au profil de l’équipe en place, et à l’ambition de développement à long terme.',
  '<150 K€', 'En  cours de validation', '["C.R.A."]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'QorW9wPQKlWpyelR', 'Mathieu', 'Kayser', 'imported-QorW9wPQKlWpyelR@placeholder.invalid', 'qualified', 59.0, 4,
  'flatchr_import', '2025-10-13T14:40:53.625Z',
  'Travailleur indépendant', '>20 ans', '["Hébergement & Restauration", "Finance & Assurances", "Gestion des entreprises", "Administration publique & gouvernement"]'::jsonb,
  TRUE, '20 à 50 pers.', TRUE, 'j’ai été impliqué à plusieurs reprises dans des opérations de transmission et d’acquisition, aussi bien comme conseil stratégique et financier que comme entrepreneur.
En tant que consultant indépendant en finance durable et Venture Partner au sein du Blue Forward Fund (Article 9 SFDR), j’ai participé à plusieurs due diligences d’investissement et à la structuration de levées de fonds pour des PME innovantes, notamment dans les secteurs de la cosmétique, de l’énergie bleue et des biotechnologies marines. Ces missions m’ont conduit à analyser des cibles, évaluer leur valorisation, structurer des tours de table et accompagner des dirigeants dans la phase de transmission ou d’ouverture de capital.

Par ailleurs, en tant qu’entrepreneur et dirigeant de ma propre structure de conseil, j’ai pu accompagner des dirigeants et des familles dans des opérations de cession partielle d’activité, de transmission, , ce qui m’a permis de comprendre les enjeux humains et financiers d’une transmission.

Enfin, mon expérience dans le secteur de l’hôtellerie restauration, à travers la gestion et le développement d’établissements m’a apporté une vision opérationnelle concrète de la reprise et du redéploiement commercial dans un environnement concurrentiel exigeant. Cette dimension m’a permis d’aborder les problématiques de valorisation, de repositionnement et de performance sous un angle à la fois économique et social.

Cette triple expérience – investisseur, entrepreneur et opérateur – me permet aujourd’hui d’aborder la reprise d’entreprise avec une approche stratégique, financière et humaine à 360°, centrée sur la continuité, la transmission et la création de valeur durable.',
  '["CEO/Directeur - Directrice général", "COO/Directeur - Directrice des opérations", "CCO/Directeur - Directrice commercial"]'::jsonb, TRUE, '["Premiers contacts avec des acteurs de la reprise", "Formation à la reprise effectuée"]'::jsonb,
  '["Hébergement & Restauration", "Finance & Assurances", "Gestion des entreprises"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'Lm5NdDw75Q2pAGbZ', 'Nicolas', 'Cwyk', 'imported-Lm5NdDw75Q2pAGbZ@placeholder.invalid', 'qualified', 29.5, 2,
  'flatchr_import', '2025-10-13T20:01:11.477Z',
  'Travailleur indépendant', '16 à 20 ans', '["Commerce de détail", "Services professionnels"]'::jsonb,
  TRUE, '<10 pers.', FALSE, NULL,
  '["COO/Directeur - Directrice des opérations"]'::jsonb, FALSE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Information & Médias", "Gestion des entreprises", "Autres services", "Services professionnels"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'xy5Jpxr4K2Enz7lV', 'Marie-claire', 'Kanaan', 'imported-xy5Jpxr4K2Enz7lV@placeholder.invalid', 'qualified', 41.0, 3,
  'flatchr_import', '2025-10-14T09:45:58.412Z',
  'Employé à temps plein', '<10 ans', '["Construction", "Santé & Assistance sociale", "Autres services"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, 'J''ai vécu une phase de recherche de repreneurs et de due diligence dans le cadre de ma propre startup et je réalise maintenant des due diligence dans le cadre d''une mission de CVC et Innovation',
  '["CFO/Directeur - Directrice financier", "Autres"]'::jsonb, TRUE, '["Recherche de cibles"]'::jsonb,
  '["Autres services"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'ENkKd807aXrd3xYG', 'Moncef', 'Chebli', 'imported-ENkKd807aXrd3xYG@placeholder.invalid', 'qualified', 32.5, 2,
  'flatchr_import', '2025-10-15T07:49:47.254Z',
  'Travailleur indépendant', '16 à 20 ans', '["Finance & Assurances"]'::jsonb,
  TRUE, '20 à 50 pers.', FALSE, NULL,
  '["Division/BU Director/Directeur - Directrice de centre de profits", "COO/Directeur - Directrice des opérations", "CFO/Directeur - Directrice financier"]'::jsonb, FALSE, '["Recherche de cibles"]'::jsonb,
  '["Finance & Assurances", "Autres services"]'::jsonb, FALSE, NULL,
  '<150 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '56Rb9AbLwGYpoNZQ', 'Francois', 'Corrignan', 'imported-56Rb9AbLwGYpoNZQ@placeholder.invalid', 'qualified', 79.0, 5,
  'flatchr_import', '2025-10-15T15:09:40.128Z',
  'Sans emploi', '>20 ans', '["Services professionnels"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'Trilingual executive with 25+ years in scaling businesses, M&A execution, and complex negotiations. Experienced in acquisition, development, and sale of companies. Strong commercial acumen – I invest in people and businesses for sustainable growth. I invest in people and business.',
  '["CEO/Directeur - Directrice général", "COO/Directeur - Directrice des opérations", "Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, FALSE, '["Formation à la reprise effectuée", "Premiers contacts avec des acteurs de la reprise", "Lettre de cadrage (projet ou final)", "Financement défini (ou en cours)", "Recherche de cibles"]'::jsonb,
  '["Transport & entreposage", "Autres services", "Services professionnels", "Immobilier & location", "Gestion des entreprises", "Industrie manufacturière", "Santé & Assistance sociale"]'::jsonb, FALSE, NULL,
  '>450 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'MQj09ZrN0ej9xoRL', 'Fabienne', 'Saugier', 'imported-MQj09ZrN0ej9xoRL@placeholder.invalid', 'qualified', 71.0, 5,
  'flatchr_import', '2025-10-16T18:34:20.051Z',
  'Autre', '>20 ans', '["Arts", "Spectacles & Loisirs", "Information & Médias", "Services professionnels", "Commerce de gros", "scientifiques & techniques"]'::jsonb,
  TRUE, '>50 pers.', TRUE, '8 ans partner M&A
DG actionnaire entreprise de cybersécurité - MBI avec fonds d''investissement (2014-2019)
5 ans coaching de Dirigeants (dont sujets de préparation à la transmission)',
  '["CEO/Directeur - Directrice général"]'::jsonb, TRUE, '["Premiers contacts avec des acteurs de la reprise", "Financement défini (ou en cours)", "Recherche de cibles", "Lettre de cadrage (projet ou final)"]'::jsonb,
  '["Arts", "Information & Médias", "scientifiques & techniques"]'::jsonb, FALSE, NULL,
  '251 K€ - 350 K€', 'Déjà bouclé', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'lV0D9aLDMzYnWELk', 'Salek', 'Chskib', 'imported-lV0D9aLDMzYnWELk@placeholder.invalid', 'qualified', 60.5, 5,
  'flatchr_import', '2025-10-20T21:07:51.715Z',
  'Employé à temps plein', '16 à 20 ans', '["Gestion des entreprises", "Industrie manufacturière"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'M&A',
  '["CEO/Directeur - Directrice général", "COO/Directeur - Directrice des opérations", "CHRO/Directeur - Directrice des ressources humaines"]'::jsonb, TRUE, '["Recherche de cibles", "Recherche d''informations uniquement"]'::jsonb,
  '["Services administratifs & de soutien", "Gestion des entreprises", "Services professionnels"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'zj8Md602O5l9YZ70', 'Thierry', 'Teisseire', 'imported-zj8Md602O5l9YZ70@placeholder.invalid', 'qualified', 76.0, 5,
  'flatchr_import', '2025-10-21T06:43:31.050Z',
  'Travailleur indépendant', '>20 ans', '["Services professionnels", "Information & Médias", "Gestion des entreprises"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'Oui, mon parcours professionnel inclut plusieurs expériences directement liées à des contextes de carve-out (séparation d''une activité d''un grand groupe) et de spin-off (création d''une nouvelle entreprise à partir d''une division existante), qui sont des formes de transmission et de restructuration d''entreprise :

Chez Wifirst (2019-2022), j''ai rejoint l''entreprise après son carve-out du groupe Bolloré Telecom. En tant que Directeur Commercial, j''ai structuré l''équipe et fortement augmenté les revenus et la valorisation de l''entreprise (+300%), préparant potentiellement le terrain pour de futures transactions impliquant les investisseurs (Capza, Amundi, BPI).

Chez Teradata Marketing Applications (Mapp digital) (2015-2019), j''ai également opéré dans un contexte post-carve-out de Teradata, sous l''égide de l''investisseur Marlin Equity Partners. Mon rôle de Chief Revenue Officer impliquait de restructurer et de développer l''activité de manière autonome.

Chez SAP (2001-2003), j''ai dirigé le lancement de SAP Markets Europe, un spin-off de SAP. J''ai mis en place le bureau parisien et généré 85 M€ de revenus la première année pleine, gérant cette nouvelle entité issue d''une structure plus large.

Ces expériences m''ont donné une compréhension approfondie des enjeux commerciaux, stratégiques et opérationnels spécifiques aux entreprises issues de transmissions ou d''acquisitions.',
  '["CEO/Directeur - Directrice général", "CCO/Directeur - Directrice commercial", "Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Recherche d''informations uniquement", "Premiers contacts avec des acteurs de la reprise", "Financement défini (ou en cours)"]'::jsonb,
  '["Construction", "Information & Médias", "Gestion des entreprises", "Industrie manufacturière", "Services professionnels", "Immobilier & location"]'::jsonb, FALSE, NULL,
  '151 K€ - 250 K€', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'KzqPnNjkAv0n31m0', 'Charles-edouard', 'Delpierre', 'imported-KzqPnNjkAv0n31m0@placeholder.invalid', 'qualified', 71.5, 5,
  'flatchr_import', '2025-10-22T17:02:57.666Z',
  'En transition professionnelle', '16 à 20 ans', '["Construction", "Autres services"]'::jsonb,
  TRUE, '>50 pers.', TRUE, 'J''ai dirigé plusieurs acquisitions et intégrations pour le groupe ENGIE, en France et à l''international',
  '["CEO/Directeur - Directrice général", "Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Construction", "Autres services", "Services professionnels", "scientifiques & techniques", "Services publics"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'xy5JpxrN7xrnz7lV', 'Sophiane', 'Saoudi', 'imported-xy5JpxrN7xrnz7lV@placeholder.invalid', 'qualified', 48.5, 3,
  'flatchr_import', '2025-10-23T05:11:47.273Z',
  'Sans emploi', '16 à 20 ans', '["Immobilier & location", "scientifiques & techniques"]'::jsonb,
  TRUE, '<10 pers.', TRUE, 'Marchand de bien en sas avecon père architecte',
  '["CTO/CIO/Directeur - Directrice des systèmes d''information"]'::jsonb, FALSE, '["Recherche d''informations uniquement", "Premiers contacts avec des acteurs de la reprise", "Formation à la reprise effectuée"]'::jsonb,
  '["Hébergement & Restauration"]'::jsonb, FALSE, NULL,
  '<150 K€', 'En  cours de validation', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'GYLqn10qqZMdmE0y', 'Romain', 'Garcia', 'imported-GYLqn10qqZMdmE0y@placeholder.invalid', 'qualified', 37.0, 2,
  'flatchr_import', '2025-10-25T08:20:41.545Z',
  'Employé à temps plein', '16 à 20 ans', '["Services publics"]'::jsonb,
  TRUE, '>50 pers.', TRUE, '2 à 3 reprises par an dans mon organisation',
  '["CFO/Directeur - Directrice financier"]'::jsonb, TRUE, '["Recherche d''informations uniquement"]'::jsonb,
  '["Commerce de détail"]'::jsonb, FALSE, NULL,
  'En cours d''évaluation / à définir', 'Déjà bouclé', '["Non, aucune"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'yVgL9kxXrx4p1PD5', 'Henri', 'Flourens', 'imported-yVgL9kxXrx4p1PD5@placeholder.invalid', 'qualified', 64.0, 5,
  'flatchr_import', '2025-11-06T19:57:19.926Z',
  'En transition professionnelle', '11 à 15 ans', '["Services professionnels", "Industrie manufacturière", "Santé & Assistance sociale", "Transport & entreposage", "Commerce de détail"]'::jsonb,
  TRUE, '20 à 50 pers.', TRUE, 'Travail comme conseil (stratégique) dans le cadre de Due Diligences d''acquisition
Préparation du rachat d''un concurrent dans une expérience opérationnelle',
  '["COO/Directeur - Directrice des opérations"]'::jsonb, FALSE, '["Financement défini (ou en cours)", "Recherche de cibles"]'::jsonb,
  '["Industrie manufacturière", "Services professionnels"]'::jsonb, TRUE, '2 à 10 m€ de CA (10 à 40 employés)
Valorisation entre 2 et 4 m€',
  '251 K€ - 350 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'lV0D9aLGMGxnWELk', 'Pierre', 'Fournis', 'imported-lV0D9aLGMGxnWELk@placeholder.invalid', 'qualified', 73.0, 5,
  'flatchr_import', '2025-11-13T08:30:58.064Z',
  'Travailleur indépendant', '>20 ans', '["Commerce de gros", "Transport & entreposage", "Autres services"]'::jsonb,
  TRUE, '>50 pers.', FALSE, NULL,
  '["COO/Directeur - Directrice des opérations", "Division/BU Director/Directeur - Directrice de centre de profits", "Autres"]'::jsonb, TRUE, '["Formation à la reprise effectuée"]'::jsonb,
  '["Industrie manufacturière", "Autres services", "Transport & entreposage", "Commerce de gros"]'::jsonb, TRUE, '- Chiffre d''affaires : > 1M€
- Equipes : 10 à 30 personnes
- Apport personnel : 300K€
- Prix de cession jusqu’à 2M€ (seul) à plus avec un fond d''investissement',
  '251 K€ - 350 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  '5aMxpQAzrDLpGZ2O', 'Paul', 'Fino', 'imported-5aMxpQAzrDLpGZ2O@placeholder.invalid', 'qualified', 48.0, 3,
  'flatchr_import', '2025-11-21T18:57:32.952Z',
  'Employé à temps plein', '11 à 15 ans', '["Finance & Assurances", "Gestion des entreprises", "Industrie manufacturière", "Autres services", "Services professionnels", "scientifiques & techniques", "Transport & entreposage", "Commerce de gros"]'::jsonb,
  TRUE, '11 à 20 pers.', TRUE, '- revente de mon entreprise actuelle (6 m€ CA)
- rachat puis revente de sites internet (150 k€ CA)',
  '["COO/Directeur - Directrice des opérations", "Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, FALSE, '["Formation à la reprise effectuée", "Financement défini (ou en cours)", "Lettre de cadrage (projet ou final)"]'::jsonb,
  '["Autres services", "Services professionnels"]'::jsonb, FALSE, NULL,
  '251 K€ - 350 K€', 'Déjà bouclé', '["Autres"]'::jsonb,
  FALSE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, lifecycle_status, tier1_score, tier2_stars,
  source, created_at,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  'mQNJ9W0zmvrp5LwD', 'Roch', 'De preneuf', 'imported-mQNJ9W0zmvrp5LwD@placeholder.invalid', 'qualified', 65.0, 5,
  'flatchr_import', '2025-11-24T17:54:31.826Z',
  'Sans emploi', '>20 ans', '["Industrie manufacturière", "Commerce de gros"]'::jsonb,
  TRUE, '20 à 50 pers.', FALSE, '3 LOI qui n''ont pas abouti',
  '["Division/BU Director/Directeur - Directrice de centre de profits"]'::jsonb, FALSE, '["Formation à la reprise effectuée", "Lettre de cadrage (projet ou final)", "Financement défini (ou en cours)", "Recherche de cibles"]'::jsonb,
  '["Industrie manufacturière", "scientifiques & techniques", "Commerce de gros"]'::jsonb, TRUE, 'Effectif > 15 personnes
CA > 2.5M€
Valorisation: finançable par LBO avec 60 à 70% de Dette Senior. OK pour travailler avec des Fonds MBI mino ou majo',
  '351 K€ - 450 K€', 'Déjà bouclé', '["C.R.A."]'::jsonb,
  TRUE, NOW(), (SELECT id FROM auth.users LIMIT 1)
);