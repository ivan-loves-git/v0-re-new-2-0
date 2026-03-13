/**
 * Leadership Assessment Configuration
 * Source of truth for all 26 questions, options, and scoring rules.
 * Based on Test_Assessment_FINAL.xlsx from Bertrand.
 */

import type { BlocAAnswer, BlocBAnswer } from "@/lib/types/leadership-assessment"

// ========================================
// BLOC A — Leadership Profile (10 binary A/B questions)
// No right/wrong — creates a style radar
// ========================================

export interface BlocAQuestion {
  id: string
  label: string
  labelEn: string
  optionA: { label: string; labelEn: string; poles: Record<string, number> }
  optionB: { label: string; labelEn: string; poles: Record<string, number> }
}

export const BLOC_A_QUESTIONS: BlocAQuestion[] = [
  {
    id: "a1",
    label: "Dans une situation complexe et incertaine, vous avez plutôt tendance à :",
    labelEn: "In a complex and uncertain situation, you tend to:",
    optionA: {
      label: "Avancer rapidement, quitte à ajuster en cours de route",
      labelEn: "Move quickly, adjusting as you go",
      poles: { drive: 1, prudence: -1 },
    },
    optionB: {
      label: "Challenger en profondeur les hypothèses avant d'agir",
      labelEn: "Deeply challenge assumptions before acting",
      poles: { prudence: 1, drive: -1 },
    },
  },
  {
    id: "a2",
    label: "Dans votre rôle de dirigeant, vous vous reconnaissez davantage dans l'affirmation suivante :",
    labelEn: "As a leader, you identify more with:",
    optionA: {
      label: "Trancher clairement les décisions clés",
      labelEn: "Clearly make key decisions",
      poles: { autorite: 1, collectif: -1 },
    },
    optionB: {
      label: "Créer un cadre de décision partagé",
      labelEn: "Create a shared decision-making framework",
      poles: { collectif: 1, autorite: -1 },
    },
  },
  {
    id: "a3",
    label: "Face à des sujets critiques pour l'entreprise, vous préférez généralement :",
    labelEn: "When facing critical business issues, you generally prefer to:",
    optionA: {
      label: "Garder personnellement la main sur les décisions importantes",
      labelEn: "Personally keep control of important decisions",
      poles: { controle: 1, delegation: -1 },
    },
    optionB: {
      label: "Déléguer rapidement et ajuster si nécessaire",
      labelEn: "Delegate quickly and adjust if needed",
      poles: { delegation: 1, controle: -1 },
    },
  },
  {
    id: "a4",
    label: "Lorsqu'un désaccord fort apparaît au sein de l'équipe, vous avez tendance à :",
    labelEn: "When a strong disagreement arises within the team, you tend to:",
    optionA: {
      label: "Trancher rapidement pour éviter l'enlisement",
      labelEn: "Decide quickly to avoid stagnation",
      poles: { autorite: 1, collectif: -1 },
    },
    optionB: {
      label: "Explorer le désaccord avant de prendre une décision",
      labelEn: "Explore the disagreement before deciding",
      poles: { collectif: 1, autorite: -1 },
    },
  },
  {
    id: "a5",
    label: "Dans vos arbitrages de dirigeant, vous privilégiez plutôt :",
    labelEn: "In your leadership trade-offs, you prioritize:",
    optionA: {
      label: "La performance, même si cela peut créer des tensions à court terme",
      labelEn: "Performance, even if it creates short-term tensions",
      poles: { court_terme: 1, long_terme: -1 },
    },
    optionB: {
      label: "La qualité de la relation pour soutenir la performance durable",
      labelEn: "Relationship quality to support lasting performance",
      poles: { long_terme: 1, court_terme: -1 },
    },
  },
  {
    id: "a6",
    label: "Lorsque vous devez décider, vous vous appuyez d'abord sur :",
    labelEn: "When making decisions, you primarily rely on:",
    optionA: {
      label: "Les données et analyses disponibles",
      labelEn: "Available data and analysis",
      poles: { prudence: 1, drive: -1 },
    },
    optionB: {
      label: "Votre intuition et votre expérience",
      labelEn: "Your intuition and experience",
      poles: { drive: 1, prudence: -1 },
    },
  },
  {
    id: "a7",
    label: "Pour les décisions critiques, vous préférez généralement :",
    labelEn: "For critical decisions, you generally prefer to:",
    optionA: {
      label: "Assumer seul la responsabilité finale",
      labelEn: "Take sole final responsibility",
      poles: { autorite: 1, collectif: -1 },
    },
    optionB: {
      label: "Partager la responsabilité avec d'autres parties prenantes",
      labelEn: "Share responsibility with other stakeholders",
      poles: { collectif: 1, autorite: -1 },
    },
  },
  {
    id: "a8",
    label: "Lorsqu'une erreur survient, votre premier réflexe est plutôt de :",
    labelEn: "When an error occurs, your first instinct is to:",
    optionA: {
      label: "Corriger rapidement et avancer",
      labelEn: "Fix quickly and move on",
      poles: { drive: 1, prudence: -1 },
    },
    optionB: {
      label: "Prendre le temps d'analyser pour en tirer des enseignements",
      labelEn: "Take time to analyze and learn from it",
      poles: { prudence: 1, drive: -1 },
    },
  },
  {
    id: "a9",
    label: "Selon vous, l'autorité d'un dirigeant repose avant tout sur :",
    labelEn: "In your view, a leader's authority rests primarily on:",
    optionA: {
      label: "La clarté, la fermeté et la capacité à trancher",
      labelEn: "Clarity, firmness, and decisiveness",
      poles: { autorite: 1, collectif: -1 },
    },
    optionB: {
      label: "La cohérence, la confiance et la constance dans le temps",
      labelEn: "Consistency, trust, and steadiness over time",
      poles: { collectif: 1, autorite: -1 },
    },
  },
  {
    id: "a10",
    label: "Dans vos choix stratégiques, vous privilégiez plutôt :",
    labelEn: "In your strategic choices, you prioritize:",
    optionA: {
      label: "L'impact rapide et visible",
      labelEn: "Quick and visible impact",
      poles: { court_terme: 1, long_terme: -1 },
    },
    optionB: {
      label: "La construction progressive dans le temps",
      labelEn: "Progressive building over time",
      poles: { long_terme: 1, court_terme: -1 },
    },
  },
]

// ========================================
// BLOC B — Situational Maturity (8 scenarios, 4 options each)
// Scored +2/+1/0/-2 with tags
// ========================================

export interface BlocBOption {
  value: BlocBAnswer
  label: string
  labelEn: string
  score: number
  tag: string
}

export interface BlocBQuestion {
  id: string
  situation: string
  situationEn: string
  options: BlocBOption[]
}

export const BLOC_B_QUESTIONS: BlocBQuestion[] = [
  {
    id: "b1",
    situation: "Trois mois après la reprise, le cédant continue d'intervenir auprès des équipes.",
    situationEn: "Three months after the acquisition, the seller keeps interfering with the teams.",
    options: [
      { value: "A", label: "Recadrer immédiatement", labelEn: "Immediately set boundaries", score: 1, tag: "Autorite" },
      { value: "B", label: "Laisser faire temporairement", labelEn: "Temporarily let it go", score: -2, tag: "Leadership_risk" },
      { value: "C", label: "Organiser un échange formel pour redéfinir les rôles", labelEn: "Organize a formal discussion to redefine roles", score: 2, tag: "Leadership_mature" },
      { value: "D", label: "Faire intervenir un tiers", labelEn: "Bring in a third party", score: 1, tag: "Gouvernance" },
    ],
  },
  {
    id: "b2",
    situation: "Une décision nécessaire est très mal perçue par une partie de l'équipe.",
    situationEn: "A necessary decision is very poorly received by part of the team.",
    options: [
      { value: "A", label: "Décider vite et expliquer après", labelEn: "Decide quickly and explain after", score: 1, tag: "Action" },
      { value: "B", label: "Retarder pour embarquer davantage", labelEn: "Delay to get more buy-in", score: 1, tag: "Social" },
      { value: "C", label: "Décider et expliquer individuellement aux personnes clés", labelEn: "Decide and explain individually to key people", score: 2, tag: "Leadership_equilibre" },
      { value: "D", label: "Déléguer la communication", labelEn: "Delegate the communication", score: 0, tag: "Responsabilite" },
    ],
  },
  {
    id: "b3",
    situation: "La banque remet en question le financement.",
    situationEn: "The bank questions the financing.",
    options: [
      { value: "A", label: "Mettre la pression", labelEn: "Apply pressure", score: -2, tag: "Finance_risk" },
      { value: "B", label: "Revoir le projet", labelEn: "Review the project", score: 1, tag: "Finance" },
      { value: "C", label: "Challenger leurs hypothèses", labelEn: "Challenge their assumptions", score: 2, tag: "Finance_mature" },
      { value: "D", label: "Chercher une alternative", labelEn: "Seek an alternative", score: 0, tag: "Finance" },
    ],
  },
  {
    id: "b4",
    situation: "Un manager clé n'atteint plus ses objectifs depuis plusieurs mois.",
    situationEn: "A key manager has been missing targets for several months.",
    options: [
      { value: "A", label: "Recadrage direct", labelEn: "Direct performance review", score: 1, tag: "Humain" },
      { value: "B", label: "Accompagnement ciblé", labelEn: "Targeted coaching", score: 2, tag: "Humain_mature" },
      { value: "C", label: "Remplacement rapide", labelEn: "Quick replacement", score: -2, tag: "Humain_risk" },
      { value: "D", label: "Attendre", labelEn: "Wait", score: 0, tag: "Humain" },
    ],
  },
  {
    id: "b5",
    situation: "La trésorerie se tend fortement à court terme.",
    situationEn: "Cash flow is getting very tight in the short term.",
    options: [
      { value: "A", label: "Réduction immédiate des coûts", labelEn: "Immediate cost reduction", score: 0, tag: "Finance" },
      { value: "B", label: "Négociation partenaires", labelEn: "Negotiate with partners", score: 1, tag: "Finance" },
      { value: "C", label: "Financement complémentaire", labelEn: "Seek additional financing", score: 1, tag: "Finance" },
      { value: "D", label: "Combinaison de plusieurs leviers", labelEn: "Combination of multiple levers", score: 2, tag: "Finance_mature" },
    ],
  },
  {
    id: "b6",
    situation: "Vous ressentez une fatigue durable liée à la charge de travail.",
    situationEn: "You feel lasting fatigue from the workload.",
    options: [
      { value: "A", label: "Continuer sans changer", labelEn: "Continue without changing", score: -2, tag: "Burnout_risk" },
      { value: "B", label: "Lever le pied", labelEn: "Slow down", score: 1, tag: "Preservation" },
      { value: "C", label: "Ajuster l'organisation", labelEn: "Adjust the organization", score: 2, tag: "Leadership_durable" },
      { value: "D", label: "En parler à un tiers de confiance", labelEn: "Talk to a trusted third party", score: 2, tag: "Self_awareness" },
    ],
  },
  {
    id: "b7",
    situation: "Une opportunité très attractive pose un problème éthique.",
    situationEn: "A very attractive opportunity raises an ethical issue.",
    options: [
      { value: "A", label: "L'accepter", labelEn: "Accept it", score: -2, tag: "Ethique_risk" },
      { value: "B", label: "La refuser", labelEn: "Refuse it", score: 2, tag: "Ethique" },
      { value: "C", label: "Chercher un compromis", labelEn: "Seek a compromise", score: 0, tag: "Ethique" },
      { value: "D", label: "Reporter la décision", labelEn: "Postpone the decision", score: 0, tag: "Ethique" },
    ],
  },
  {
    id: "b8",
    situation: "Une décision stratégique passée s'avère être une erreur.",
    situationEn: "A past strategic decision turns out to be a mistake.",
    options: [
      { value: "A", label: "Corriger discrètement", labelEn: "Fix discreetly", score: 0, tag: "Responsabilite" },
      { value: "B", label: "Assumer publiquement l'erreur", labelEn: "Publicly own the mistake", score: 2, tag: "Responsabilite_mature" },
      { value: "C", label: "Minimiser", labelEn: "Minimize", score: -2, tag: "Responsabilite_risk" },
      { value: "D", label: "Impliquer l'équipe", labelEn: "Involve the team", score: 1, tag: "Apprentissage" },
    ],
  },
]

// ========================================
// BLOC C — Personal Risk (8 Likert 1-5 statements)
// Direct: score = response. Inverse: score = 6 - response.
// ========================================

export interface BlocCQuestion {
  id: string
  label: string
  labelEn: string
  direction: "direct" | "inverse"
}

export const BLOC_C_QUESTIONS: BlocCQuestion[] = [
  {
    id: "c1",
    label: "Quand les choses dérapent, j'ai tendance à reprendre personnellement la main.",
    labelEn: "When things go wrong, I tend to take personal control.",
    direction: "inverse",
  },
  {
    id: "c2",
    label: "Je sais reconnaître quand je vais trop vite pour mon entourage.",
    labelEn: "I can recognize when I'm moving too fast for those around me.",
    direction: "direct",
  },
  {
    id: "c3",
    label: "Je me sens parfois attaqué lorsque mes décisions sont challengées.",
    labelEn: "I sometimes feel attacked when my decisions are challenged.",
    direction: "inverse",
  },
  {
    id: "c4",
    label: "Je sollicite activement du feedback critique.",
    labelEn: "I actively seek critical feedback.",
    direction: "direct",
  },
  {
    id: "c5",
    label: "J'ai du mal à me déconnecter durablement du travail.",
    labelEn: "I find it hard to disconnect from work for extended periods.",
    direction: "inverse",
  },
  {
    id: "c6",
    label: "Je suis à l'aise avec l'idée de ne pas tout maîtriser.",
    labelEn: "I'm comfortable with the idea of not controlling everything.",
    direction: "direct",
  },
  {
    id: "c7",
    label: "Je respecte mes engagements même sous forte pression.",
    labelEn: "I honor my commitments even under strong pressure.",
    direction: "direct",
  },
  {
    id: "c8",
    label: "Je prends systématiquement en compte l'impact long terme de mes décisions.",
    labelEn: "I systematically consider the long-term impact of my decisions.",
    direction: "direct",
  },
]

// ========================================
// Form Steps Configuration
// ========================================

export const ASSESSMENT_STEPS = [
  {
    id: 1,
    title: "Profil de leadership",
    titleEn: "Leadership Profile",
    description: "Votre style de prise de décision",
    descriptionEn: "Your decision-making style",
  },
  {
    id: 2,
    title: "Mises en situation",
    titleEn: "Situational Scenarios",
    description: "Comment réagiriez-vous ?",
    descriptionEn: "How would you react?",
  },
  {
    id: 3,
    title: "Auto-évaluation",
    titleEn: "Self-Assessment",
    description: "Votre perception de vous-même",
    descriptionEn: "Your self-perception",
  },
  {
    id: 4,
    title: "Vérification",
    titleEn: "Review",
    description: "Vérifiez vos réponses",
    descriptionEn: "Review your answers",
  },
] as const

// Likert scale labels
export const LIKERT_LABELS = {
  1: { fr: "Pas du tout d'accord", en: "Strongly disagree" },
  2: { fr: "Plutôt pas d'accord", en: "Somewhat disagree" },
  3: { fr: "Neutre", en: "Neutral" },
  4: { fr: "Plutôt d'accord", en: "Somewhat agree" },
  5: { fr: "Tout à fait d'accord", en: "Strongly agree" },
} as const
