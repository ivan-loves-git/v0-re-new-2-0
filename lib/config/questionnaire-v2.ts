import { SECTOR_OPTIONS } from '@/lib/utils/opportunity-sector'

/**
 * Questionnaire V2 Configuration
 *
 * Source of truth for all intake form questions, options, and French labels.
 * Based on questionnaire-spec-v2.md
 */

// ========================================
// WHO Questions (Q05-Q10) - Profile Quality
// ========================================

export const WHO_QUESTIONS = {
  q05: {
    id: 'q05',
    field: 'q05_status',
    label: 'Quel est votre statut actuel ?',
    labelEn: 'What is your current professional status?',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'entrepreneur', label: 'Entrepreneur / Chef d\'entreprise', points: 5 },
      { value: 'freelance', label: 'Freelance / Indépendant', points: 4 },
      { value: 'employee', label: 'Salarié', points: 3 },
      { value: 'transition', label: 'En transition professionnelle', points: 2 },
      { value: 'other', label: 'Autre', points: 1 }
    ]
  },
  q06: {
    id: 'q06',
    field: 'q06_experience',
    label: 'Combien d\'années d\'expérience professionnelle avez-vous ?',
    labelEn: 'How many years of professional experience do you have?',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'more_than_20', label: 'Plus de 20 ans', points: 15 },
      { value: '10_to_20', label: '10 à 20 ans', points: 10 },
      { value: 'less_than_10', label: 'Moins de 10 ans', points: 5 }
    ]
  },
  q07: {
    id: 'q07',
    field: 'q07_leadership',
    label: 'Avez-vous déjà exercé des fonctions de direction ou de responsabilité élargie ?',
    labelEn: 'Have you held leadership or management positions?',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'general_management', label: 'Direction générale / Responsabilité P&L complète', points: 30 },
      { value: 'mgmt_over_10', label: 'Management d\'équipes > 10 personnes', points: 20 },
      { value: 'mgmt_under_10', label: 'Management d\'équipes < 10 personnes', points: 10 },
      { value: 'none', label: 'Non', points: 0 }
    ]
  },
  q08: {
    id: 'q08',
    field: 'q08_crisis',
    label: 'Avez-vous déjà géré une situation de forte complexité ou de crise ?',
    labelEn: 'Have you managed a situation of high complexity or crisis?',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'multiple', label: 'Oui, plusieurs fois', points: 20 },
      { value: 'once', label: 'Oui, une fois', points: 10 },
      { value: 'none', label: 'Non', points: 0 }
    ]
  },
  q09: {
    id: 'q09',
    field: 'q09_investment',
    label: 'Avez-vous déjà été impliqué dans une décision d\'investissement significative ? (ex. M&A, acquisition)',
    labelEn: 'Have you been involved in a significant investment decision? (M&A, acquisition)',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'both', label: 'Oui, à la fois personnellement et professionnellement', points: 15 },
      { value: 'personal', label: 'Oui, personnellement', points: 12 },
      { value: 'professional', label: 'Oui, professionnellement', points: 10 },
      { value: 'none', label: 'Non', points: 0 }
    ]
  },
  q10: {
    id: 'q10',
    field: 'q10_impact',
    label: 'Avez-vous déjà pris une décision professionnelle avec un impact personnel direct et durable ?',
    labelEn: 'Have you made a professional decision with direct and lasting personal impact?',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'financial', label: 'Oui – avec un impact financier personnel significatif (ex. : baisse durable de revenus, investissement, garanties)', points: 15 },
      { value: 'trajectory', label: 'Oui – avec un impact durable sur ma trajectoire pro (ex. : quitter un poste stable, changement majeur de secteur, rôle, ou expatriation)', points: 12 },
      { value: 'limited', label: 'Oui – avec un impact personnel limité (ex. : évolution de poste ou de périmètre sans exposition forte)', points: 6 },
      { value: 'none', label: 'Non', points: 0 }
    ]
  }
} as const

// ========================================
// Q11 v3 - Priority choice (added 2026-04-23)
// Binary: SME acquisition is either the preferred career path (0 pts)
// or one option among others (-10 WHEN penalty).
// ========================================

export const PRIORITY_CHOICE_QUESTION = {
  q11_priority: {
    id: 'q11_priority',
    field: 'q11_priority_choice',
    label: 'Pour vous la reprise est ?',
    labelEn: 'For you, acquiring a company is?',
    required: true,
    type: 'radio' as const,
    options: [
      { value: 'preferred', label: 'Mon option préférentielle de carrière', points: 0 },
      { value: 'one_among_others', label: 'Une option parmi d\'autres', points: -10 },
    ],
  },
} as const

// ========================================
// Project Status (Q11 legacy numbering) - Contributes to WHEN
// ========================================

export const PROJECT_STATUS_QUESTION = {
  q11: {
    id: 'q11',
    field: 'q11_project_status',
    label: 'À ce stade, où en est votre projet de reprise ?',
    labelEn: 'At this stage, where is your acquisition project?',
    helpText: '(sélectionnez ce qui convient) Sélectionnez toutes les étapes qui s\'appliquent. Le score sera basé sur l\'option la plus avancée.',
    helpTextEn: 'Select all stages that apply. The score will be based on the most advanced option.',
    required: true,
    type: 'checkbox' as const, // Multi-select
    options: [
      { value: 'discovery', label: 'Découverte / Je veux en apprendre plus', points: 0 },
      { value: 'exploratory', label: 'Phase exploratoire / réflexion', points: 5 },
      { value: 'framed', label: 'Projet cadré (cible et apport définis)', points: 10 },
      { value: 'searching', label: 'Recherche active de cibles', points: 15 },
      { value: 'loi', label: 'Discussions avancées (LOI en cours)', points: 20 }
    ]
  }
} as const

// ========================================
// WHEN Questions (Q12-Q16) - Project Maturity
// ========================================

export const WHEN_QUESTIONS = {
  q12: {
    id: 'q12',
    field: 'q12_geo_zones',
    label: 'Zone(s) géographique(s) de recherche prioritaire',
    labelEn: 'What are your priority geographic search zones?',
    required: true,
    type: 'checkbox' as const, // Multi-select
    options: [
      { value: 'all-france', label: 'Toute la France' },
      { value: 'auvergne-rhone-alpes', label: 'Auvergne-Rhône-Alpes' },
      { value: 'bourgogne-franche-comte', label: 'Bourgogne-Franche-Comté' },
      { value: 'bretagne', label: 'Bretagne' },
      { value: 'centre-val-de-loire', label: 'Centre-Val de Loire' },
      { value: 'corse', label: 'Corse' },
      { value: 'dom-tom', label: 'DOM-TOM' },
      { value: 'grand-est', label: 'Grand Est' },
      { value: 'hauts-de-france', label: 'Hauts-de-France' },
      { value: 'ile-de-france', label: 'Île-de-France' },
      { value: 'normandie', label: 'Normandie' },
      { value: 'nouvelle-aquitaine', label: 'Nouvelle-Aquitaine' },
      { value: 'occitanie', label: 'Occitanie' },
      { value: 'pays-de-la-loire', label: 'Pays de la Loire' },
      { value: 'paca', label: 'Provence-Alpes-Côte d\'Azur' }
    ]
  },
  q13: {
    id: 'q13',
    field: 'q13_target_sectors_v2',
    label: 'Quel(s) secteur(s) d\'activité ciblez-vous pour votre projet de reprise ?',
    labelEn: 'Which sector(s) are you targeting for your acquisition project?',
    required: true,
    type: 'checkbox' as const, // Multi-select
    options: SECTOR_OPTIONS
  },
  q14: {
    id: 'q14',
    field: 'q14_deal_size',
    label: 'Taille d\'opération visée : (valeur des titres)',
    labelEn: 'Target deal size (equity value)',
    helpText: 'Vous pouvez sélectionner plusieurs fourchettes si vous êtes flexible.',
    helpTextEn: 'You can select multiple ranges if you are flexible.',
    required: true,
    type: 'checkbox' as const, // Multi-select
    options: [
      { value: '1-3M', label: '1-3 M€' },
      { value: '3-5M', label: '3-5 M€' },
      { value: '>5M', label: '>5 M€' }
    ]
  },
  q15: {
    id: 'q15',
    field: 'q15_structure',
    label: 'Dans votre projet de reprise comment envisagez-vous la structuration du capital et votre rôle ?',
    labelEn: 'How do you envision the capital structure and your role?',
    helpText: 'Cette question aide à évaluer la cohérence financière de votre projet.',
    helpTextEn: 'This question helps evaluate the financial coherence of your project.',
    required: true,
    type: 'checkbox' as const, // Multi-select
    options: [
      { value: 'majority_without_fund', label: 'Repreneur majoritaire sans fonds' },
      { value: 'majority_with_minority', label: 'Repreneur majoritaire avec fonds minoritaire' },
      { value: 'manager_with_majority', label: 'Manager associé à un fonds majoritaire' },
      { value: 'havent_thought', label: 'Je n\'y ai pas encore réfléchi' }
    ]
  },
  q16: {
    id: 'q16',
    field: 'q16_equity',
    label: 'Quel est votre apport personnel total ?',
    labelEn: 'What is your total personal equity contribution?',
    required: true,
    type: 'radio' as const, // Single select
    options: [
      // 'tbd' is now displayed as "<150 K€" — the enum value is kept so old
      // records keep scoring correctly. v3 adds a -10 penalty on this value.
      { value: 'tbd', label: '<150 K€' },
      { value: '151-250', label: '151-250 K€' },
      { value: '251-350', label: '251-350 K€' },
      { value: '351-450', label: '351-450 K€' },
      { value: '>450', label: 'Plus de 450 K€' }
    ]
  }
} as const

// ========================================
// Needs Assessment (Q17-Q18) - No Scoring
// ========================================

export const NEEDS_QUESTIONS = {
  q17: {
    id: 'q17',
    field: 'q17_current_needs',
    label: 'Dans ce type de projet, quel est votre besoin principal aujourd\'hui ?',
    labelEn: 'In this type of project, what is your main need today?',
    required: true,
    type: 'checkbox' as const, // Multi-select
    options: [
      { value: 'project_launch', label: 'Lancement / cadrage de projet' },
      { value: 'deal_access', label: 'Accès à des opportunités de reprise' },
      { value: 'partner_access', label: 'Accès à des partenaires (avocats, experts-comptables)' },
      { value: 'financing', label: 'Recherche de financement' },
      { value: 'other_support', label: 'Autre accompagnement' }
    ]
  },
  q18: {
    id: 'q18',
    field: 'q18_investment_thesis_url',
    label: 'Partagez votre lettre de cadrage (si disponible)',
    labelEn: 'Share your investment thesis document (if available)',
    helpText: 'Formats acceptés: PDF, DOC, DOCX (max 4 MB)',
    helpTextEn: 'Accepted formats: PDF, DOC, DOCX (max 4 MB)',
    required: false,
    type: 'file' as const
  }
} as const

// ========================================
// Contact Information (Q01-Q04) - No Scoring
// ========================================

export const CONTACT_FIELDS = {
  firstName: {
    id: 'first_name',
    field: 'first_name',
    label: 'Prénom',
    labelEn: 'First name',
    required: true,
    type: 'text' as const
  },
  lastName: {
    id: 'last_name',
    field: 'last_name',
    label: 'Nom',
    labelEn: 'Last name',
    required: true,
    type: 'text' as const
  },
  email: {
    id: 'email',
    field: 'email',
    label: 'Email',
    labelEn: 'Email',
    required: true,
    type: 'email' as const
  },
  phone: {
    id: 'phone',
    field: 'phone',
    label: 'Téléphone',
    labelEn: 'Phone',
    required: true,
    type: 'tel' as const
  },
  cv: {
    id: 'cv_url',
    field: 'cv_url',
    label: 'CV',
    labelEn: 'Resume/CV',
    helpText: 'Formats acceptés: PDF, DOC, DOCX (max 4 MB)',
    helpTextEn: 'Accepted formats: PDF, DOC, DOCX (max 4 MB)',
    required: true,
    type: 'file' as const
  },
  linkedin: {
    id: 'linkedin_url',
    field: 'linkedin_url',
    label: 'Profil LinkedIn',
    labelEn: 'LinkedIn Profile',
    placeholder: 'https://linkedin.com/in/...',
    required: false,
    type: 'url' as const
  }
} as const

// ========================================
// Form Steps Configuration
// ========================================

export const INTAKE_STEPS = [
  {
    id: 1,
    title: 'Contact',
    titleEn: 'Contact',
    description: 'Vos coordonnées',
    descriptionEn: 'Your contact information'
  },
  {
    id: 2,
    title: 'Profil',
    titleEn: 'Profile',
    description: 'Votre expérience et parcours',
    descriptionEn: 'Your experience and background'
  },
  {
    id: 3,
    title: 'Projet',
    titleEn: 'Project',
    description: 'L\'état de votre projet',
    descriptionEn: 'Your project status'
  },
  {
    id: 4,
    title: 'Critères',
    titleEn: 'Criteria',
    description: 'Vos critères de recherche',
    descriptionEn: 'Your search criteria'
  },
  {
    id: 5,
    title: 'Besoins',
    titleEn: 'Needs',
    description: 'Vos besoins actuels',
    descriptionEn: 'Your current needs'
  },
  {
    id: 6,
    title: 'Vérification',
    titleEn: 'Review',
    description: 'Vérifiez vos réponses',
    descriptionEn: 'Review your answers'
  }
] as const

// ========================================
// Complete Configuration Export
// ========================================

export const QUESTIONNAIRE_V2_CONFIG = {
  contact: CONTACT_FIELDS,
  who: WHO_QUESTIONS,
  priorityChoice: PRIORITY_CHOICE_QUESTION,
  projectStatus: PROJECT_STATUS_QUESTION,
  when: WHEN_QUESTIONS,
  needs: NEEDS_QUESTIONS,
  steps: INTAKE_STEPS
} as const

export type QuestionnaireV2Config = typeof QUESTIONNAIRE_V2_CONFIG
