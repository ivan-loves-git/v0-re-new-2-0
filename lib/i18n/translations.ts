/**
 * Questionnaire translations (FR/EN)
 * Used in the public intake form
 */

export type Language = 'fr' | 'en'

export const translations = {
  // Form header
  formTitle: {
    fr: 'Profil Repreneur',
    en: 'Buyer Application',
  },

  // Navigation buttons
  continue: {
    fr: 'Continuer',
    en: 'Continue',
  },
  back: {
    fr: 'Retour',
    en: 'Back',
  },
  submit: {
    fr: 'Soumettre ma candidature',
    en: 'Submit my application',
  },
  review: {
    fr: 'Vérifier mes réponses',
    en: 'Review my answers',
  },
  edit: {
    fr: 'Modifier',
    en: 'Edit',
  },

  // Step 1: Contact
  step1Title: {
    fr: 'Vos coordonnées',
    en: 'Your contact information',
  },
  step1Description: {
    fr: 'Ces informations nous permettront de vous contacter.',
    en: 'This information will allow us to contact you.',
  },
  firstName: {
    fr: 'Prénom',
    en: 'First name',
  },
  lastName: {
    fr: 'Nom',
    en: 'Last name',
  },
  email: {
    fr: 'Email',
    en: 'Email',
  },
  phone: {
    fr: 'Téléphone',
    en: 'Phone',
  },
  cv: {
    fr: 'CV',
    en: 'Resume',
  },
  cvHelpText: {
    fr: 'PDF, DOC ou DOCX. Maximum 10MB.',
    en: 'PDF, DOC or DOCX. Maximum 10MB.',
  },
  cvUploadText: {
    fr: 'Cliquez ou déposez votre CV ici',
    en: 'Click or drop your resume here',
  },
  cvUploaded: {
    fr: 'CV téléchargé',
    en: 'Resume uploaded',
  },
  linkedin: {
    fr: 'Profil LinkedIn (optionnel)',
    en: 'LinkedIn profile (optional)',
  },
  uploading: {
    fr: 'Téléchargement...',
    en: 'Uploading...',
  },

  // Step 2: WHO (Profile)
  step2Title: {
    fr: 'Votre profil',
    en: 'Your profile',
  },
  step2Description: {
    fr: 'Ces questions nous aident à mieux comprendre votre parcours et votre expérience.',
    en: 'These questions help us better understand your background and experience.',
  },

  // Q05: Current status
  q05Label: {
    fr: 'Quel est votre statut actuel ?',
    en: 'What is your current status?',
  },
  q05_entrepreneur: {
    fr: "Entrepreneur / Chef d'entreprise",
    en: 'Entrepreneur / Business owner',
  },
  q05_freelance: {
    fr: 'Freelance / Indépendant',
    en: 'Freelance / Self-employed',
  },
  q05_employee: {
    fr: 'Salarié',
    en: 'Employee',
  },
  q05_transition: {
    fr: 'En transition professionnelle',
    en: 'In career transition',
  },
  q05_other: {
    fr: 'Autre',
    en: 'Other',
  },

  // Q06: Experience
  q06Label: {
    fr: "Combien d'années d'expérience professionnelle avez-vous ?",
    en: 'How many years of professional experience do you have?',
  },
  q06_more_than_20: {
    fr: 'Plus de 20 ans',
    en: 'More than 20 years',
  },
  q06_10_to_20: {
    fr: '10 à 20 ans',
    en: '10 to 20 years',
  },
  q06_less_than_10: {
    fr: 'Moins de 10 ans',
    en: 'Less than 10 years',
  },

  // Q07: Leadership
  q07Label: {
    fr: 'Avez-vous déjà exercé des fonctions de direction ou de responsabilité élargie ?',
    en: 'Have you held leadership or expanded responsibility positions?',
  },
  q07_general_management: {
    fr: "Direction générale (CEO, DG, Gérant)",
    en: 'General management (CEO, Managing Director)',
  },
  q07_mgmt_over_10: {
    fr: 'Management de plus de 10 personnes',
    en: 'Management of more than 10 people',
  },
  q07_mgmt_under_10: {
    fr: 'Management de moins de 10 personnes',
    en: 'Management of fewer than 10 people',
  },
  q07_none: {
    fr: 'Pas de responsabilité managériale',
    en: 'No managerial responsibility',
  },

  // Q08: Crisis management
  q08Label: {
    fr: 'Avez-vous déjà géré une situation de forte complexité ou de crise ?',
    en: 'Have you managed a situation of high complexity or crisis?',
  },
  q08_multiple: {
    fr: 'Oui, plusieurs fois',
    en: 'Yes, multiple times',
  },
  q08_once: {
    fr: 'Oui, une fois',
    en: 'Yes, once',
  },
  q08_none: {
    fr: 'Non',
    en: 'No',
  },

  // Q09: Investment decisions
  q09Label: {
    fr: "Avez-vous déjà été impliqué dans une décision d'investissement significative ? (ex. M&A, acquisition)",
    en: 'Have you been involved in a significant investment decision? (e.g. M&A, acquisition)',
  },
  q09_both: {
    fr: 'Oui, personnelles et professionnelles',
    en: 'Yes, both personal and professional',
  },
  q09_personal: {
    fr: 'Oui, personnelles uniquement',
    en: 'Yes, personal only',
  },
  q09_professional: {
    fr: 'Oui, professionnelles uniquement',
    en: 'Yes, professional only',
  },
  q09_none: {
    fr: 'Non',
    en: 'No',
  },

  // Q10: Personal impact
  q10Label: {
    fr: 'Avez-vous déjà pris une décision professionnelle avec un impact personnel direct et durable ?',
    en: 'Have you made a professional decision with direct and lasting personal impact?',
  },
  q10_financial: {
    fr: 'Oui – avec un impact financier personnel significatif (ex. : baisse durable de revenus, investissement, garanties)',
    en: 'Yes – with significant personal financial impact (e.g. sustained income drop, investment, guarantees)',
  },
  q10_trajectory: {
    fr: 'Oui – avec un impact durable sur ma trajectoire pro (ex. : quitter un poste stable, changement majeur de secteur, rôle, ou expatriation)',
    en: 'Yes – with lasting impact on my career path (e.g. leaving a stable job, major sector/role change, expatriation)',
  },
  q10_limited: {
    fr: 'Oui – avec un impact personnel limité (ex. : évolution de poste ou de périmètre sans exposition forte)',
    en: 'Yes – with limited personal impact (e.g. role evolution without high exposure)',
  },
  q10_none: {
    fr: 'Non',
    en: 'No',
  },

  // Step 3: Project status
  step3Title: {
    fr: 'Votre projet',
    en: 'Your project',
  },
  step3Description: {
    fr: "Où en êtes-vous dans votre projet de reprise d'entreprise ?",
    en: 'Where are you in your business acquisition project?',
  },

  // Q11: Project status
  q11Label: {
    fr: 'Quelles étapes avez-vous déjà franchies ?',
    en: 'What steps have you already completed?',
  },
  q11HelpText: {
    fr: 'Sélectionnez toutes les étapes que vous avez franchies. La plus avancée sera prise en compte.',
    en: 'Select all the steps you have completed. The most advanced will be taken into account.',
  },
  q11_discovery: {
    fr: "Je m'informe sur la reprise d'entreprise",
    en: 'I am learning about business acquisition',
  },
  q11_exploratory: {
    fr: "J'ai commencé à explorer le marché des cibles",
    en: 'I have started exploring the target market',
  },
  q11_framed: {
    fr: "J'ai défini mes critères de recherche précis",
    en: 'I have defined my precise search criteria',
  },
  q11_searching: {
    fr: 'Je suis en recherche active de cibles',
    en: 'I am actively searching for targets',
  },
  q11_loi: {
    fr: "J'ai signé ou suis en discussion pour une LOI",
    en: 'I have signed or am in discussion for an LOI',
  },
  mostAdvancedStep: {
    fr: 'étape la plus avancée',
    en: 'most advanced step',
  },

  // Step 4: WHEN (Search criteria)
  step4Title: {
    fr: 'Vos critères de recherche',
    en: 'Your search criteria',
  },
  step4Description: {
    fr: 'Ces informations nous aident à évaluer la cohérence financière de votre projet.',
    en: 'This information helps us evaluate the financial coherence of your project.',
  },

  // Q12: Geographic zones (French regions)
  q12Label: {
    fr: 'Zone(s) géographique(s) de recherche prioritaire',
    en: 'Priority geographic search zone(s)',
  },
  q12_all_france: {
    fr: 'Toute la France',
    en: 'All of France',
  },
  q12_ile_de_france: {
    fr: 'Île-de-France',
    en: 'Île-de-France (Paris region)',
  },
  q12_auvergne_rhone_alpes: {
    fr: 'Auvergne-Rhône-Alpes',
    en: 'Auvergne-Rhône-Alpes',
  },
  q12_paca: {
    fr: "Provence-Alpes-Côte d'Azur",
    en: "Provence-Alpes-Côte d'Azur",
  },
  q12_occitanie: {
    fr: 'Occitanie',
    en: 'Occitanie',
  },
  q12_nouvelle_aquitaine: {
    fr: 'Nouvelle-Aquitaine',
    en: 'Nouvelle-Aquitaine',
  },
  q12_hauts_de_france: {
    fr: 'Hauts-de-France',
    en: 'Hauts-de-France',
  },
  q12_grand_est: {
    fr: 'Grand Est',
    en: 'Grand Est',
  },
  q12_pays_de_la_loire: {
    fr: 'Pays de la Loire',
    en: 'Pays de la Loire',
  },
  q12_bretagne: {
    fr: 'Bretagne',
    en: 'Brittany',
  },
  q12_normandie: {
    fr: 'Normandie',
    en: 'Normandy',
  },
  q12_bourgogne_franche_comte: {
    fr: 'Bourgogne-Franche-Comté',
    en: 'Bourgogne-Franche-Comté',
  },
  q12_centre_val_de_loire: {
    fr: 'Centre-Val de Loire',
    en: 'Centre-Val de Loire',
  },
  q12_corse: {
    fr: 'Corse',
    en: 'Corsica',
  },
  q12_dom_tom: {
    fr: 'DOM-TOM',
    en: 'Overseas territories',
  },

  // Q13: Target sectors
  q13Label: {
    fr: "Quel(s) secteur(s) d'activité ciblez-vous pour votre projet de reprise ?",
    en: 'Which sector(s) are you targeting for your acquisition project?',
  },
  q13_agroalimentaire: { fr: 'Agroalimentaire', en: 'Agrifood' },
  q13_manufacturing: { fr: 'Industrie manufacturière', en: 'Manufacturing' },
  q13_heavy_industry: { fr: 'Industrie lourde', en: 'Heavy industry' },
  q13_pharma_medical: {
    fr: 'Industrie pharmaceutique & Dispositifs médicaux',
    en: 'Pharmaceuticals & Medical devices',
  },
  q13_health_services: { fr: 'Services de santé', en: 'Health services' },
  q13_automotive_mobility: { fr: 'Automobile & Mobilité', en: 'Automotive & Mobility' },
  q13_textile_luxury_fashion: { fr: 'Textile, Luxe & Mode', en: 'Textile, Luxury & Fashion' },
  q13_trade_distribution: {
    fr: 'Commerce, Négoce & Distribution',
    en: 'Trade, Wholesale & Distribution',
  },
  q13_btp_construction: { fr: 'BTP & Construction', en: 'Building & Construction' },
  q13_b2b_services: { fr: 'Services aux entreprises (B2B)', en: 'Business services (B2B)' },
  q13_b2c_services: { fr: 'Services aux particuliers (B2C)', en: 'Consumer services (B2C)' },
  q13_tech_digital: { fr: 'Tech & Digital', en: 'Tech & Digital' },
  q13_environment_energy: { fr: 'Environnement & Énergie', en: 'Environment & Energy' },
  q13_hospitality_leisure: {
    fr: 'Hôtellerie, Restauration & Loisirs',
    en: 'Hospitality, Food service & Leisure',
  },
  q13_transport_logistics: { fr: 'Transport & Logistique', en: 'Transport & Logistics' },
  q13_other: {
    fr: 'Autre',
    en: 'Other',
  },

  // Q14: Deal size
  q14Label: {
    fr: "Taille d'opération visée : (valeur des titres)",
    en: 'Target deal size (equity value)',
  },
  q14HelpText: {
    fr: 'Vous pouvez sélectionner plusieurs fourchettes si vous êtes flexible.',
    en: 'You can select multiple ranges if you are flexible.',
  },
  q14_1_3M: {
    fr: '1-3 M€',
    en: '€1-3M',
  },
  q14_3_5M: {
    fr: '3-5 M€',
    en: '€3-5M',
  },
  q14_5M_plus: {
    fr: '>5 M€',
    en: '>€5M',
  },

  // Q15: Capital structure
  q15Label: {
    fr: 'Dans votre projet de reprise comment envisagez-vous la structuration du capital et votre rôle ?',
    en: 'In your acquisition project, how do you envision the capital structure and your role?',
  },
  q15HelpText: {
    fr: 'Cette question nous aide à comprendre votre positionnement dans la reprise.',
    en: 'This question helps us understand your positioning in the acquisition.',
  },
  q15_majority_without_fund: {
    fr: 'Majoritaire seul (sans fonds)',
    en: 'Majority owner alone (without fund)',
  },
  q15_majority_with_minority: {
    fr: 'Majoritaire avec minoritaire financier',
    en: 'Majority with minority financial partner',
  },
  q15_manager_with_majority: {
    fr: 'Manager avec fonds majoritaire',
    en: 'Manager with majority fund',
  },
  q15_havent_thought: {
    fr: "Je n'ai pas encore réfléchi à cette question",
    en: "I haven't thought about this yet",
  },

  // Q16: Equity contribution
  q16Label: {
    fr: "Quel apport en fonds propres pouvez-vous mobiliser ?",
    en: 'What equity contribution can you mobilize?',
  },
  q16_tbd: {
    fr: '< 150 K€',
    en: '< €150K',
  },
  q16_151_250: {
    fr: '151 à 250 K€',
    en: '€151-250K',
  },
  q16_251_350: {
    fr: '251 à 350 K€',
    en: '€251-350K',
  },
  q16_351_450: {
    fr: '351 à 450 K€',
    en: '€351-450K',
  },
  q16_450_plus: {
    fr: 'Plus de 450 K€',
    en: 'More than €450K',
  },

  // Step 5: Needs
  step5Title: {
    fr: 'Vos besoins',
    en: 'Your needs',
  },
  step5Description: {
    fr: 'Dites-nous comment nous pouvons vous accompagner.',
    en: 'Tell us how we can support you.',
  },

  // Q17: Current needs
  q17Label: {
    fr: 'Quels sont vos besoins actuels ?',
    en: 'What are your current needs?',
  },
  q17_project_launch: {
    fr: 'Lancement / cadrage de projet',
    en: 'Project launch / framing',
  },
  q17_deal_access: {
    fr: 'Accès à des opportunités de reprise',
    en: 'Access to acquisition opportunities',
  },
  q17_partner_access: {
    fr: 'Accès à des partenaires (avocats, experts-comptables)',
    en: 'Access to partners (lawyers, accountants)',
  },
  q17_financing: {
    fr: 'Recherche de financement',
    en: 'Financing search',
  },
  q17_other_support: {
    fr: 'Autre accompagnement',
    en: 'Other support',
  },

  // Q18: Investment thesis
  q18Label: {
    fr: "Thèse d'investissement (optionnel)",
    en: 'Investment thesis (optional)',
  },
  q18HelpText: {
    fr: "Si vous avez formalisé votre thèse d'investissement, vous pouvez la partager ici.",
    en: 'If you have formalized your investment thesis, you can share it here.',
  },
  thesisUploadText: {
    fr: 'Cliquez ou déposez votre document ici (optionnel)',
    en: 'Click or drop your document here (optional)',
  },
  documentUploaded: {
    fr: 'Document téléchargé',
    en: 'Document uploaded',
  },

  // Consent
  marketingConsent: {
    fr: "J'accepte de recevoir des communications de Re-New",
    en: 'I agree to receive communications from Re-New',
  },
  marketingConsentDescription: {
    fr: 'En cochant cette case, vous acceptez que Re-New vous contacte par email concernant votre projet de reprise et les services proposés. Vous pouvez vous désinscrire à tout moment.',
    en: 'By checking this box, you agree that Re-New may contact you by email about your acquisition project and services offered. You can unsubscribe at any time.',
  },
  gdprNotice: {
    fr: 'Vos données sont protégées conformément au RGPD. Consultez notre politique de confidentialité pour plus d\'informations.',
    en: 'Your data is protected in accordance with GDPR. See our privacy policy for more information.',
  },

  // Step 6: Review
  step6Title: {
    fr: 'Vérification',
    en: 'Review',
  },
  step6Description: {
    fr: 'Veuillez vérifier vos réponses avant de soumettre.',
    en: 'Please review your answers before submitting.',
  },
  sectionContact: {
    fr: 'Coordonnées',
    en: 'Contact information',
  },
  sectionProfile: {
    fr: 'Profil',
    en: 'Profile',
  },
  sectionProject: {
    fr: 'Projet',
    en: 'Project',
  },
  sectionCriteria: {
    fr: 'Critères',
    en: 'Criteria',
  },
  sectionNeeds: {
    fr: 'Besoins',
    en: 'Needs',
  },

  // Success page
  successTitle: {
    fr: 'Candidature envoyée !',
    en: 'Application submitted!',
  },
  successMessage: {
    fr: 'Merci pour votre candidature. Notre équipe va étudier votre profil et vous recontactera dans les plus brefs délais.',
    en: 'Thank you for your application. Our team will review your profile and contact you as soon as possible.',
  },

  // Errors
  errorRequired: {
    fr: 'Ce champ est requis',
    en: 'This field is required',
  },
  errorInvalidEmail: {
    fr: 'Email invalide',
    en: 'Invalid email',
  },
  errorInvalidPhone: {
    fr: 'Numéro de téléphone invalide',
    en: 'Invalid phone number',
  },
  errorFileType: {
    fr: 'Format non accepté. Utilisez PDF, DOC ou DOCX.',
    en: 'Invalid format. Use PDF, DOC or DOCX.',
  },
  errorFileSize: {
    fr: 'Fichier trop volumineux. Maximum 10MB.',
    en: 'File too large. Maximum 10MB.',
  },
  errorUpload: {
    fr: 'Erreur lors du téléchargement',
    en: 'Upload error',
  },

  // Test mode
  testModeLabel: {
    fr: 'Mode test activé',
    en: 'Test mode enabled',
  },
  fillAll: {
    fr: 'Remplir tout & aller à la review',
    en: 'Fill all & go to review',
  },
  fillStep: {
    fr: 'Remplir cette étape',
    en: 'Fill this step',
  },
} as const

export type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, lang: Language): string {
  return translations[key][lang]
}
