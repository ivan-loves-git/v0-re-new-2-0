import { PDR_ARCHIVE_TABLES } from "./pdr-archive"

type ArchiveTable = (typeof PDR_ARCHIVE_TABLES)[number]

/** Fixed SQL allowlist for the separately authorized local export command. */
export function pdrArchiveSourceQuery(table: ArchiveTable) {
  if (!PDR_ARCHIVE_TABLES.includes(table)) throw new Error("Archive source table is not allowlisted")
  const physical = table === "storage_objects" ? "storage.objects"
    : table === "storage_buckets" ? "storage.buckets"
    : `public.${table}`
  const filter = table === "storage_objects" ? " WHERE t.bucket_id IN ('pdr-attachments','pdr-intake-attachments')"
    : table === "storage_buckets" ? " WHERE t.id IN ('pdr-attachments','pdr-intake-attachments')"
    : table === "ai_generation_runs" ? " WHERE t.feature = 'pdr_screening'"
    : table === "ai_generation_events" ? " WHERE t.generation_id IN (SELECT generation_id FROM public.ai_generation_runs WHERE feature = 'pdr_screening')"
    : ""
  return `SELECT to_jsonb(t) AS row FROM ${physical} AS t${filter}`
}
