import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

describe("Ticket #94 review follow-ups", () => {
  it("puts classification filtering and an explicit marker on the primary opportunity work surface", () => {
    const workSurface = source("components/opportunities/opportunity-work-surface-table.tsx")
    expect(workSurface).toContain('key: "classification", label: "Classification"')
    expect(workSurface).toContain("classificationFilter !== \"all\"")
    expect(workSurface).toContain("OpportunityClassificationBadge")
  })

  it("gives conversion classification a visible accessible group label and error state", () => {
    const panel = source("components/pursuits/external-pursuit-conversion-panel.tsx")
    expect(panel).toContain('id="external-conversion-classification-label"')
    expect(panel).toContain('aria-labelledby="external-conversion-classification-label"')
    expect(panel).toContain("aria-invalid={Boolean(errors.classification)}")
  })

  it("keeps a rollback-compatible conversion while rehearsing the strict candidate path", () => {
    const rehearsal = source("scripts/rehearse-external-pursuit-conversion.sql")
    const concurrency = source("scripts/rehearse-external-pursuit-conversion-concurrency.sh")
    expect(rehearsal).toContain("117_explicit_demo_real_creation.sql")
    expect(rehearsal).toContain("uuid,text,uuid,uuid,uuid,boolean,text,text")
    expect(rehearsal).toContain("w164_legacy_conversion_compatibility_failed")
    expect(rehearsal).toContain("w164_strict_creator_accepted_omission")
    expect(concurrency).toContain("117_explicit_demo_real_creation.sql")
    expect(concurrency).toContain("'w109-race-staff-a','w109-race-convert-a'")
  })

  it("has a separately rehearsed post-deploy cutover and ordered rollback", () => {
    const rehearsal = source("scripts/rehearse-external-pursuit-conversion.sql")
    const cutover = source("scripts/118_ticket_94_strict_creation_cutover.sql")
    const rollback = source("scripts/118_ticket_94_strict_creation_cutover_rollback.sql")
    const externalContract = source("docs/data-models/external-pursuit-data-model-v1.md")

    expect(rehearsal).toContain("118_ticket_94_strict_creation_cutover.sql")
    expect(rehearsal).toContain("w164_final_cutover_left_legacy_endpoint_callable")
    expect(rehearsal).toContain("118_ticket_94_strict_creation_cutover_rollback.sql")
    expect(cutover).toContain("create_opportunity_with_office_context_legacy_118")
    expect(cutover).toContain("convert_external_pursuit_to_opportunity_legacy_118")
    expect(rollback).toContain("Run this first, then restore the prior application")
    expect(externalContract).toContain("explicitly\n    choose REAL or DEMO")
    expect(externalContract).toContain("create_opportunity_with_office_context_v2")
  })
})
