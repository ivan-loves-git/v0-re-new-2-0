/**
 * Questionnaire translations (FR/EN)
 * Used in the public intake form
 */

export type Language = 'fr' | 'en'

export const translations = {
  // Form header
  formTitle: {
    fr: 'Candidature Repreneur',
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
    fr: 'Quel est votre statut professionnel actuel ?',
    en: 'What is your current professional status?',
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
    fr: 'Quel est votre niveau de responsabilité managériale le plus élevé ?',
    en: 'What is your highest level of managerial responsibility?',
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
    fr: "Avez-vous géré des situations de crise ou de retournement d'entreprise ?",
    en: 'Have you managed crisis or business turnaround situations?',
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
    fr: "Avez-vous été impliqué dans des décisions d'investissement significatives ?",
    en: 'Have you been involved in significant investment decisions?',
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
    fr: "Quel a été l'impact de vos décisions sur votre situation personnelle ?",
    en: 'What has been the impact of your decisions on your personal situation?',
  },
  q10_financial: {
    fr: 'Impact financier significatif positif',
    en: 'Significant positive financial impact',
  },
  q10_trajectory: {
    fr: 'Changement de trajectoire professionnelle',
    en: 'Career trajectory change',
  },
  q10_limited: {
    fr: 'Impact limité',
    en: 'Limited impact',
  },
  q10_none: {
    fr: 'Aucun impact notable',
    en: 'No notable impact',
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

  // Q12: Geographic zones
  q12Label: {
    fr: 'Dans quelles zones géographiques recherchez-vous ?',
    en: 'In which geographic areas are you searching?',
  },
  q12_idf: {
    fr: 'Île-de-France',
    en: 'Paris region (Île-de-France)',
  },
  q12_north: {
    fr: 'Nord de la France',
    en: 'Northern France',
  },
  q12_east: {
    fr: 'Est de la France',
    en: 'Eastern France',
  },
  q12_west: {
    fr: 'Ouest de la France',
    en: 'Western France',
  },
  q12_south: {
    fr: 'Sud de la France',
    en: 'Southern France',
  },
  q12_all: {
    fr: 'Toute la France',
    en: 'All of France',
  },
  q12_international: {
    fr: 'International',
    en: 'International',
  },

  // Q13: Target sectors
  q13Label: {
    fr: 'Quels secteurs ciblez-vous ?',
    en: 'What sectors are you targeting?',
  },
  q13_industry: {
    fr: 'Industrie',
    en: 'Industry',
  },
  q13_services: {
    fr: 'Services',
    en: 'Services',
  },
  q13_tech: {
    fr: 'Tech / Digital',
    en: 'Tech / Digital',
  },
  q13_retail: {
    fr: 'Commerce / Distribution',
    en: 'Retail / Distribution',
  },
  q13_health: {
    fr: 'Santé / Pharma',
    en: 'Health / Pharma',
  },
  q13_construction: {
    fr: 'BTP / Construction',
    en: 'Construction',
  },
  q13_agri: {
    fr: 'Agroalimentaire',
    en: 'Food & Agriculture',
  },
  q13_other: {
    fr: 'Autre',
    en: 'Other',
  },

  // Q14: Deal size
  q14Label: {
    fr: "Quelle taille d'entreprise recherchez-vous (valeur d'entreprise) ?",
    en: 'What company size are you looking for (enterprise value)?',
  },
  q14HelpText: {
    fr: "La valeur d'entreprise inclut la dette nette. Sélectionnez toutes les tailles qui vous intéressent.",
    en: 'Enterprise value includes net debt. Select all sizes that interest you.',
  },
  q14_1_3M: {
    fr: '1 à 3 M€',
    en: '€1-3M',
  },
  q14_3_5M: {
    fr: '3 à 5 M€',
    en: '€3-5M',
  },
  q14_5M_plus: {
    fr: 'Plus de 5 M€',
    en: 'More than €5M',
  },

  // Q15: Capital structure
  q15Label: {
    fr: 'Quelle structure de capital envisagez-vous ?',
    en: 'What capital structure do you envision?',
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
    fr: 'À définir',
    en: 'To be determined',
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
  q17_training: {
    fr: 'Formation à la reprise',
    en: 'Acquisition training',
  },
  q17_sourcing: {
    fr: 'Sourcing de cibles',
    en: 'Target sourcing',
  },
  q17_financing: {
    fr: 'Accompagnement financement',
    en: 'Financing support',
  },
  q17_due_diligence: {
    fr: 'Due diligence',
    en: 'Due diligence',
  },
  q17_negotiation: {
    fr: 'Aide à la négociation',
    en: 'Negotiation support',
  },
  q17_legal: {
    fr: 'Support juridique',
    en: 'Legal support',
  },
  q17_network: {
    fr: 'Réseau de repreneurs',
    en: 'Buyer network',
  },
  q17_other: {
    fr: 'Autre',
    en: 'Other',
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
