import type { OpportunityNdaArtifactRole } from "@/lib/types/opportunity"

export type ExternalHandoffType = "e4" | "e6" | "e7"
export type ExternalHandoffChannel = "email" | "phone" | "meeting" | "other"
export type ExternalHandoffDocumentSnapshot = {
  artifact_id: string
  document_id: string
  version: number
  role: OpportunityNdaArtifactRole
  content_sha256: string
  storage_bucket: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
}
export type ExternalHandoffContext = {
  opportunity_id: string
  repreneur_id: string
  is_demo: boolean
  cycle_id: string
  upstream_id: string
  handoff_type: ExternalHandoffType
  source_office_id: string | null
  documents: ExternalHandoffDocumentSnapshot[]
}
export type ExternalHandoffInput = {
  matchId: string
  context: ExternalHandoffContext
  operationKey: string
  exchangeDate: string
  /** Civil local time, only when actually known. Europe/Paris is the operating timezone. */
  exchangeTime: string | null
  channel: ExternalHandoffChannel
  reference: string
  selectionToken?: string
}
