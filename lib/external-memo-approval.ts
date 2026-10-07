import type { ExternalHandoffContext, ExternalHandoffInput } from "@/lib/external-pursuit-handoff"
export type MemoDocumentSnapshot = {
  document_id: string; storage_bucket: string; storage_path: string; file_name: string;
  mime_type: string; size_bytes: number; recipient_match_id: string | null; recipient_repreneur_id: string | null
}
export type ExternalMemoContext = ExternalHandoffContext & { memo: MemoDocumentSnapshot; nda_expires_at: string; e7_evidence_id: string }
export type ExternalMemoInput = Omit<ExternalHandoffInput, "context"> & { context: ExternalMemoContext }
