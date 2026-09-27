import { afterEach, describe, expect, it } from "vitest"
import { mkdtemp, chmod, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { createPdrArchive, extractPdrObject, extractPdrRecord, verifyPdrArchive, retrievePdrObject, retrievePdrRecord, type ArchiveSource } from "../pdr-archive"

const id = {
  goal: "11111111-1111-4111-8111-111111111111",
  milestone: "22222222-2222-4222-8222-222222222222",
  request: "33333333-3333-4333-8333-333333333333",
  proposal: "44444444-4444-4444-8444-444444444444",
  card: "55555555-5555-4555-8555-555555555555",
  run: "66666666-6666-4666-8666-666666666666",
  preview: "88888888-8888-4888-8888-888888888888",
  snapshot: "77777777-7777-4777-8777-777777777777",
}
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex")

function fixture(): ArchiveSource {
  const legacyBytes = Buffer.from("old attachment")
  const intakeBytes = Buffer.from("staff attachment")
  return {
    sourceReadAt: "2026-09-27T14:00:00.000Z",
    tables: {
      pdr_feedback: [{ id: "f1", work_card_id: id.card, body: "original feedback" }],
      pdr_goals: [{ id: id.goal, slug: "scale-active-pursuits", title: "Old goal" }],
      pdr_milestones: [{ id: id.milestone, goal_id: id.goal, slug: "old-milestone" }],
      pdr_proposals: [{ id: id.proposal, original_text: "original wording", conversation: [{ answer: "retained" }], matched_work_card_id: id.card, suggested_goal_id: id.goal }],
      pdr_requests: [{ id: id.request, goal_id: id.goal, milestone_id: id.milestone, description: "historical request" }],
      pdr_work_cards: [{ id: id.card, strategic_item_id: id.request, source_proposal_id: id.proposal, reference_number: 12, legacy_codes: ["W-001"] }],
      wave_pdr_governance_capabilities: [{ singleton: true, actor_user_id: "ivan", can_disposition: true }],
      wave_pdr_history_attachments: [{ id: "a1", proposal_id: id.proposal, work_card_id: null, storage_bucket: "pdr-intake-attachments", storage_path: "proposals/a.pdf", size_bytes: intakeBytes.length, content_sha256: null, original_filename: "a.pdf" }],
      wave_pdr_screening_records: [{ id: "s1", proposal_id: id.proposal, generation_id: id.run, governance_snapshot_id: id.snapshot, governance_snapshot_digest: digest("projection"), output: { assessment: "saved" } }],
      ai_generation_runs: [{ generation_id: id.run, feature: "pdr_screening", status: "succeeded" }, { generation_id: id.preview, feature: "pdr_screening", status: "failed" }],
      ai_generation_events: [{ id: "e1", generation_id: id.run, event_type: "rendered" }, { id: "e2", generation_id: id.preview, event_type: "discarded" }],
      wave_governance_snapshots: [{ id: id.snapshot, snapshot_digest: digest("projection"), payload: { sourceCommit: "f".repeat(40) } }],
      wave_governance_projection_current: [{ projection_key: "current", snapshot_id: id.snapshot, snapshot_digest: digest("projection") }],
      storage_buckets: [{ id: "pdr-attachments", public: false }, { id: "pdr-intake-attachments", public: false }],
      storage_objects: [
        { bucket_id: "pdr-attachments", name: "legacy/old.pdf" },
        { bucket_id: "pdr-intake-attachments", name: "proposals/a.pdf" },
      ],
    },
    objects: [
      { bucket: "pdr-attachments", name: "legacy/old.pdf", bytes: legacyBytes },
      { bucket: "pdr-intake-attachments", name: "proposals/a.pdf", bytes: intakeBytes },
    ],
  }
}

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function privateRoot() {
  const root = await mkdtemp(join(tmpdir(), "pdr-archive-test-"))
  await chmod(root, 0o700)
  roots.push(root)
  return root
}

describe("private PDR archive operator seam", () => {
  it("preserves original rows, IDs, links and both buckets' bytes for verified retrieval", async () => {
    const root = await privateRoot()
    const archive = await createPdrArchive(root, fixture())
    const verified = await verifyPdrArchive(archive)
    expect(verified.counts.pdr_proposals).toBe(1)
    expect(verified.counts.storage_objects).toBe(2)
    const retrieved = await retrievePdrRecord(archive, "W-012")
    expect(retrieved.record.id).toBe(id.card)
    expect(retrieved.record.legacy_codes).toEqual(["W-001"])
    const proposal = await retrievePdrRecord(archive, `pdr:proposal/${id.proposal}`)
    expect(proposal.record.original_text).toBe("original wording")
    expect(proposal.attachments[0].bytes.toString()).toBe("staff attachment")
    const legacy = await retrievePdrObject(archive, "pdr-attachments", "legacy/old.pdf")
    expect(legacy.toString()).toBe("old attachment")
    const extraction = await extractPdrRecord(archive, `pdr:proposal/${id.proposal}`, root)
    expect(JSON.parse(await readFile(join(extraction, "record.json"), "utf8")).conversation).toEqual([{ answer: "retained" }])
    const legacyFile = await extractPdrObject(archive, "pdr-attachments", "legacy/old.pdf", root)
    expect(await readFile(legacyFile)).toEqual(legacy)
  })

  it("fails verification when attachment bytes change after export", async () => {
    const root = await privateRoot()
    const archive = await createPdrArchive(root, fixture())
    const manifest = JSON.parse(await readFile(join(archive, "manifest.json"), "utf8"))
    const object = manifest.objects.find((item: { bucket: string }) => item.bucket === "pdr-intake-attachments")
    await writeFile(join(archive, object.file), "tampered")
    await expect(verifyPdrArchive(archive)).rejects.toThrow(/digest|size/i)
  })

  it("rejects missing linked history and missing attachment objects", async () => {
    const root = await privateRoot()
    const missingParent = fixture()
    missingParent.tables.pdr_requests = []
    await expect(createPdrArchive(root, missingParent)).rejects.toThrow(/strategic_item_id/)
    const missingObject = fixture()
    missingObject.objects = missingObject.objects.filter((item) => item.bucket !== "pdr-intake-attachments")
    await expect(createPdrArchive(root, missingObject)).rejects.toThrow(/storage object/)
  })

  it("rejects a saved screening record whose governance snapshot is absent or mismatched", async () => {
    const root = await privateRoot()
    const absent = fixture()
    absent.tables.wave_pdr_screening_records[0].governance_snapshot_id = "99999999-9999-4999-8999-999999999999"
    await expect(createPdrArchive(root, absent)).rejects.toThrow(/governance_snapshot_id/)
    const wrongDigest = fixture()
    wrongDigest.tables.wave_pdr_screening_records[0].governance_snapshot_digest = digest("different")
    await expect(createPdrArchive(root, wrongDigest)).rejects.toThrow(/snapshot digest/)
  })

  it("rejects an archive destination that another local user could read", async () => {
    const root = await privateRoot()
    await chmod(root, 0o755)
    await expect(createPdrArchive(root, fixture())).rejects.toThrow(/private/)
  })
})
