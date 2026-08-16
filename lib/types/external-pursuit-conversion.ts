import type {
  MaOfficeIntakeOffice,
  OpportunityGeographyOption,
} from "@/lib/types/opportunity"

/** Staff must retain this key while retrying an uncertain conversion request. */
export interface ExternalPursuitConversionInput {
  publicTitle: string
  geographyNodeId: string
  sourceOfficeId: string
  primaryAffiliationId: string
}

export interface ExternalPursuitConversionResult {
  success: boolean
  message: string
  opportunityId?: string
  opportunityReference?: string
  fieldErrors?: Record<string, string>
}

/** Server-provided only; never pass dossier content as defaults to this form. */
export interface ExternalPursuitConversionPanelProps {
  pursuitId: string
  officeOptions: MaOfficeIntakeOffice[]
  geographyOptions: OpportunityGeographyOption[]
}
