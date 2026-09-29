import type { Language } from "./translations"
import {
  getOpportunityMatchStatusLabel,
  getOpportunityPursuitStageLabel,
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
  type OpportunityMatchStatus,
  type OpportunityPursuitStage,
} from "@/lib/types/opportunity"

const matchFrench: Record<OpportunityMatchStatus, string> = {
  draft: "Brouillon",
  shortlisted: "Présélectionnée",
  proposed: "Proposée",
  interested: "Intérêt envoyé",
  withdrawn: "Intérêt retiré",
  declined: "Écartée",
  active_pursuit: "Dossier de reprise actif",
  dropped: "Dossier de reprise interrompu",
  completed: "Terminé",
}

const stageFrench: Record<OpportunityPursuitStage, string> = {
  interest: "Intérêt confirmé",
  nda_signed: "NDA signé",
  info_memo_received: "Note d’information reçue",
  qa_with_ma_firm: "Échanges avec l’intermédiaire",
  intermediary_meeting: "Rencontre avec l’intermédiaire",
  seller_meeting: "Rencontre avec le cédant",
  loi: "Lettre d’intention",
  closed: "Conclu",
  dropped: "Interrompu",
}

const declineFrench: Record<string, string> = {
  geography: "Géographie",
  sector: "Secteur d’activité",
  size_metrics: "Taille et indicateurs",
  business_model: "Modèle économique",
  other: "Autre",
}

export function matchStatusUiLabel(status: OpportunityMatchStatus, language: Language) {
  return language === "fr" ? matchFrench[status] ?? status : getOpportunityMatchStatusLabel(status)
}

export function pursuitStageUiLabel(stage: OpportunityPursuitStage, language: Language) {
  return language === "fr" ? stageFrench[stage] ?? stage : getOpportunityPursuitStageLabel(stage)
}

export function declineReasonUiLabel(reason: string, language: Language) {
  if (language === "fr") return declineFrench[reason] ?? reason
  return OPPORTUNITY_DECLINE_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason
}
