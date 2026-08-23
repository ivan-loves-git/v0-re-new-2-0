import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildFixtureManifest } from "@/lib/qa/phase-b.mjs"

describe("protected QA Deals fixture contract", () => {
  it("pins an independent active-pursuit owner in the manifest", () => {
    const manifest = buildFixtureManifest("qa-deals-fixture")
    expect(manifest.ids.lockedRepreneur).toMatch(/^[0-9a-f-]{36}$/)
    expect(manifest.ids.lockedRepreneur).not.toBe(manifest.ids.portalRepreneur)
    expect(manifest.databaseRows).toContainEqual(expect.objectContaining({ table: "repreneurs", id: manifest.ids.lockedRepreneur }))
  })

  it("persists every dynamic Deals ID before both reconsideration boundaries and safe DEMO filtering", () => {
    const source = readFileSync(`${process.cwd()}/tests/golden/golden-journeys.spec.ts`, "utf8")
    const declinedCreated = source.indexOf("const declinedOpportunityId = await createManifestOwnedDeal")
    const persistedDeclinedOpportunity = source.indexOf("declinedOpportunityId } })")
    const locked = source.indexOf("INSERT INTO public.opportunity_matches (opportunity_id, repreneur_id, status, pursuit_stage")
    const persistedLocked = source.indexOf("lockedMatchId } })")
    const declined = source.indexOf("INSERT INTO public.opportunity_matches (opportunity_id, repreneur_id, status, decline_reason_categories")
    const persistedDeclined = source.indexOf("declinedMatchId } })")
    const droppedCreated = source.indexOf("const droppedOpportunityId = await createManifestOwnedDeal")
    const persistedDroppedOpportunity = source.indexOf("droppedOpportunityId } })")
    const dropped = source.indexOf("INSERT INTO public.opportunity_matches (\n        opportunity_id, repreneur_id, status, decline_reason_categories")
    const persistedDropped = source.indexOf("droppedMatchId } })")
    const demo = source.indexOf("SET is_demo=true")

    expect(declinedCreated).toBeGreaterThan(-1)
    expect(persistedDeclinedOpportunity).toBeGreaterThan(declinedCreated)
    expect(locked).toBeGreaterThan(persistedDeclinedOpportunity)
    expect(persistedLocked).toBeGreaterThan(locked)
    expect(declined).toBeGreaterThan(persistedLocked)
    expect(persistedDeclined).toBeGreaterThan(declined)
    expect(droppedCreated).toBeGreaterThan(persistedDeclined)
    expect(persistedDroppedOpportunity).toBeGreaterThan(droppedCreated)
    expect(dropped).toBeGreaterThan(persistedDroppedOpportunity)
    expect(persistedDropped).toBeGreaterThan(dropped)
    expect(demo).toBeGreaterThan(persistedDropped)
    expect(source).toContain("Interest sent, awaiting Re-New validation")
    expect(source).toContain("Someone is already positioned")
    expect(source).toContain("Not a fit")
    expect(source).toContain("Pursuit dropped")
    expect(source).toContain("evidence_count: 0, document_count: 0")
    expect(source).toContain("captureClientErrors")
    expect(source).toContain("3 visible deal(s)")
    expect(source).toContain("2 visible deal(s)")
    expect(source).toContain("Pursuit dropped")
    expect(source).toContain("Deal not visible in portal preview")
  })
})
