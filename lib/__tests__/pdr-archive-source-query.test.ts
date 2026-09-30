import { describe, expect, it } from "vitest"
import { pdrArchiveSourceQuery } from "../pdr-archive-source-query"

describe("PDR archive source allowlist", () => {
  it("reads the two real Storage tables, scoped to both PDR buckets", () => {
    expect(pdrArchiveSourceQuery("storage_objects")).toBe(
      "SELECT to_jsonb(t) AS row FROM storage.objects AS t WHERE t.bucket_id IN ('pdr-attachments','pdr-intake-attachments')",
    )
    expect(pdrArchiveSourceQuery("storage_buckets")).toBe(
      "SELECT to_jsonb(t) AS row FROM storage.buckets AS t WHERE t.id IN ('pdr-attachments','pdr-intake-attachments')",
    )
  })

  it("scopes shared AI history but reads original PDR rows without projection", () => {
    expect(pdrArchiveSourceQuery("ai_generation_runs")).toContain("WHERE t.feature = 'pdr_screening'")
    expect(pdrArchiveSourceQuery("ai_generation_events")).toContain("WHERE t.generation_id IN (SELECT generation_id FROM public.ai_generation_runs WHERE feature = 'pdr_screening')")
    expect(pdrArchiveSourceQuery("pdr_proposals")).toBe("SELECT to_jsonb(t) AS row FROM public.pdr_proposals AS t")
  })
})
