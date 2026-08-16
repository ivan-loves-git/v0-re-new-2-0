import type {
  MaOfficeIntakeOffice,
  OpportunityGeographyOption,
} from "@/lib/types/opportunity"
import type { ExternalPursuitOperationLockHandler } from "@/lib/external-pursuit-operation-lock"

/** Staff must retain this key while retrying an uncertain conversion request. */
export interface ExternalPursuitConversionInput {
  readonly publicTitle: string
  readonly geographyNodeId: string
  readonly sourceOfficeId: string
  readonly primaryAffiliationId: string
}

export interface ExternalPursuitConversionResult {
  success: boolean
  message: string
  /** Unknown commit outcome: freeze inputs and retry the exact snapshot/key. */
  ambiguous?: boolean
  opportunityId?: string
  opportunityReference?: string
  fieldErrors?: Record<string, string>
}

export interface ExternalPursuitDeletionPreflightResult {
  success: boolean
  message: string
}

/**
 * Integration contract for the board/detail mount. The host owns visibility;
 * this standalone panel owns only the explicit conversion form.
 */
export const EXTERNAL_PURSUIT_CONVERSION_MOUNT_CONTRACT = {
  role: "staff-only",
  surface: "one active unfinished External Pursuit card or detail",
  defaults: "all conversion fields start empty; never derive from dossier data",
  options: "canonical W-039 geography and active real non-default non-Acme offices",
  success: "navigate to the newly created staff-only Draft",
  deletion: "W-108 preflight must pass before any attachment object is removed",
} as const

/** Server-provided only; never pass dossier content as defaults to this form. */
export interface ExternalPursuitConversionPanelProps {
  pursuitId: string
  officeOptions: MaOfficeIntakeOffice[]
  geographyOptions: OpportunityGeographyOption[]
  onOperationLockChange?: ExternalPursuitOperationLockHandler
}
