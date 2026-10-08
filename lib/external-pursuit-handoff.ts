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
/** Server-resolved current private LDC; only staff handoff contexts contain it. */
export type ExternalLdcSource = {
  source_object_id: string
  source_version: string
  source_updated_at: string
  profile_source_sha256: string
  source_path: string
  source_upload_id: string | null
  file_name: string
  mime_type: "application/pdf"
  size_bytes: number
  content_sha256: string | null
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
  ldc?: ExternalLdcSource
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
