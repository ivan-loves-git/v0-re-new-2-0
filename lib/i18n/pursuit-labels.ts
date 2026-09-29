import type { Language } from "./translations"
import type { ExternalPursuitAvailability, ExternalPursuitStage } from "@/lib/types/external-pursuit"
import { externalPursuitDueStateLabel, type ExternalPursuitDueState } from "@/lib/utils/external-pursuit-due-state"
import { getOpportunityJourneyLabel, type OpportunityJourney } from "@/lib/utils/opportunity-journey"

const stageEnglish: Record<ExternalPursuitStage, string> = {
  identified: "Identified",
  contact_qualification: "Contact / qualification",
  information: "Information",
  meetings: "Meetings",
  negotiation: "Negotiation",
  loi: "LOI",
  due_diligence_financing: "DD / financing",
  completed: "Completed",
  dropped_archived: "Dropped / archived",
}

const stageFrench: Record<ExternalPursuitStage, string> = {
  identified: "Identifiée",
  contact_qualification: "Contact / qualification",
  information: "Information",
  meetings: "Rencontres",
  negotiation: "Négociation",
  loi: "Lettre d’intention",
  due_diligence_financing: "Audit / financement",
  completed: "Terminée",
  dropped_archived: "Interrompue / archivée",
}

const availabilityEnglish: Record<ExternalPursuitAvailability, string> = {
  available: "Available",
  limited: "Limited availability",
  unavailable: "Unavailable",
  unknown: "Availability unknown",
}

const availabilityFrench: Record<ExternalPursuitAvailability, string> = {
  available: "Disponible",
  limited: "Disponibilité limitée",
  unavailable: "Indisponible",
  unknown: "Disponibilité inconnue",
}

const dueFrench: Record<ExternalPursuitDueState, string> = {
  no_date: "Sans échéance",
  due_today: "À faire aujourd’hui",
  upcoming: "À venir",
  overdue: "En retard",
}

const journeyFrench: Partial<Record<OpportunityJourney, string>> = {
  draft: "Brouillon",
  live_in_inventory: "Disponible dans le portefeuille",
  matching: "Mise en relation",
  proposed: "Proposée",
  interest_received: "Intérêt reçu",
  active_pursuit: "Dossier de reprise actif",
  nda_signed: "NDA signé",
  info_memo_received: "Note d’information reçue",
  qa_with_ma_firm: "Échanges avec l’intermédiaire",
  intermediary_meeting: "Rencontre avec l’intermédiaire",
  seller_meeting: "Rencontre avec le cédant",
  loi: "Lettre d’intention",
  closed: "Conclu",
  dropped: "Interrompu",
  paused: "Suspendu",
  archived: "Archivé",
}

export function pursuitStageUiLabel(stage: ExternalPursuitStage, language: Language) {
  return language === "fr" ? stageFrench[stage] ?? stage : stageEnglish[stage] ?? stage
}

export function pursuitAvailabilityUiLabel(value: ExternalPursuitAvailability, language: Language) {
  return language === "fr" ? availabilityFrench[value] ?? value : availabilityEnglish[value] ?? value
}

export function pursuitDueUiLabel(value: ExternalPursuitDueState, language: Language) {
  return language === "fr" ? dueFrench[value] ?? value : externalPursuitDueStateLabel(value)
}

export function canonicalJourneyUiLabel(value: string, language: Language) {
  if (language === "fr") return journeyFrench[value as OpportunityJourney] ?? value
  return getOpportunityJourneyLabel(value as OpportunityJourney)
}
