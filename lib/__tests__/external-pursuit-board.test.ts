import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { projectCanonicalJourneyToBoard } from "@/lib/utils/external-pursuit-board"
import {
  contactIdempotencyKey,
  hasContactValue,
  isCompleteContact,
  retryKeyFor,
} from "@/lib/utils/external-pursuit-client"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/095_external_pursuit_board.sql")
const board = source("components/pursuits/external-pursuit-board.tsx")
const portal = source("components/portal/portal-shell.tsx")
const sidebar = source("components/app-sidebar.tsx")
const rehearsal = source("scripts/rehearse-external-pursuit-board.sql")

describe("W-106 pursuit board", () => {
  it("derives the board position from the established canonical journey, not a board-owned state", () => {
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "active", matchStatus: "draft", pursuitStage: null })).toMatchObject({ journey: "matching", stage: "identified" })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "active", matchStatus: "proposed", pursuitStage: null })).toMatchObject({ journey: "proposed", stage: "identified" })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "active", matchStatus: "interested", pursuitStage: null })).toMatchObject({ journey: "interest_received", stage: "contact_qualification" })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "active", matchStatus: "active_pursuit", pursuitStage: "info_memo_received" })).toMatchObject({ journey: "info_memo_received", stage: "information" })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "closed", matchStatus: "completed", pursuitStage: "closed" })).toMatchObject({ journey: "closed", stage: "completed" })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "active", matchStatus: "dropped", pursuitStage: "dropped" })).toMatchObject({ journey: "dropped", stage: "dropped_archived" })
  })

  it("does not let a closed opportunity turn proposed or declined sibling matches into completed pursuits", () => {
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "closed", matchStatus: "completed", pursuitStage: "closed" })).toMatchObject({ journey: "closed", stage: "completed" })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "closed", matchStatus: "proposed", pursuitStage: null })).toMatchObject({ journey: "proposed", stage: null })
    expect(projectCanonicalJourneyToBoard({ opportunityStatus: "closed", matchStatus: "declined", pursuitStage: null })).toMatchObject({ journey: "dropped", stage: null })
  })

  it("keeps external board reads role-safe and deletion requests staff-visible only", () => {
    expect(migration).toContain("SECURITY DEFINER SET search_path = ''")
    expect(migration).toContain("p.owner_repreneur_id = actor_owner AND p.deletion_status = 'active'")
    expect(migration).toContain("actor_role = 'staff' OR")
    expect(migration).toContain("FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("TO service_role")
    expect(migration).toContain("move_external_pursuit_stage")
  })

  it("uses unambiguous create identity and a narrow stage-only mutation", () => {
    expect(migration).toContain("v_dossier_id UUID")
    expect(migration).toContain("RETURNING inserted_dossier.id INTO v_dossier_id")
    expect(migration).not.toContain("RETURNING id INTO id")
    expect(board).toContain("moveExternalPursuitStage(record.id, stage, idempotencyKey)")
    expect(board).toContain("updateExternalPursuit(editing.id, { ...draft, stage: undefined }, idempotencyKey)")
    expect(board).not.toContain("updateExternalPursuit(record.id, { title: record.title, stage })")
  })

  it("ships a rollback-only runtime create and two-actor stale-title rehearsal", () => {
    expect(rehearsal).toContain("W-106 disposable PG17 rehearsal")
    expect(rehearsal).toContain("Owner latest title")
    expect(rehearsal).toContain("w106-staff-stage-move")
    expect(rehearsal).toContain("dossier.title = 'Owner latest title'")
    expect(rehearsal).toContain("ROLLBACK")
  })

  it("makes provenance and the external boundary explicit on every item", () => {
    expect(board).toContain("authorised Re-New staff, who can see all external dossier detail by default")
    expect(board).toContain("never enter matching, source records, confidentiality gates, exports or Re-New KPIs")
    expect(board).toContain('Re-New · read-only')
    expect(board).toContain('External')
    expect(board).toContain("Open canonical journey")
  })

  it("keeps title-only intake, explicit staff ownership, labelled controls and responsive stage groups", () => {
    expect(board).toContain('setDraft(blankDraft())')
    expect(board).toContain('setOwnerId("")')
    expect(board).toContain('stage: "identified"')
    expect(board).toContain("<Label htmlFor={id}")
    expect(board).toContain("ariaLabel={`Move ${record.title} stage`}")
    expect(board).toContain("grid gap-4 lg:flex lg:overflow-x-auto")
    expect(board).toContain("max-h-[90svh] overflow-y-auto")
    expect(board).toContain("Availability")
    expect(board).toContain("Optional details not added")
    expect(board).toContain("EXTERNAL_PURSUIT_AVAILABILITY")
  })

  it("keeps contact and destructive retries stable without silently dropping incomplete rows", () => {
    expect(hasContactValue({ email: "buyer@example.test" })).toBe(true)
    expect(isCompleteContact({ email: "buyer@example.test" })).toBe(false)
    expect(isCompleteContact({ organisation: "Buyer Co", phone: "+331234" })).toBe(true)
    expect(contactIdempotencyKey("save-key", "stable-client-id")).toBe("save-key:contact:stable-client-id")

    const retryKeys = new Map<string, string>()
    let generated = 0
    const createKey = () => `retry-${++generated}`
    expect(retryKeyFor(retryKeys, "delete-request:dossier-1", createKey)).toBe("retry-1")
    expect(retryKeyFor(retryKeys, "delete-request:dossier-1", createKey)).toBe("retry-1")
    expect(retryKeyFor(retryKeys, "delete-fulfill:dossier-1", createKey)).toBe("retry-2")

    expect(board).toContain("contactIdempotencyKey(idempotencyKey, contact.clientId)")
    expect(board).not.toContain("contact.id ?? index")
    expect(board).toContain("Complete the highlighted contact rows")
    expect(board).toContain("Permanently delete “${confirmation.record.title}”?")
    expect(board).toContain("Review and permanently delete")
  })

  it("adds the owner and staff routes without replacing Re-New deal discovery", () => {
    expect(portal).toContain('href: "/portal/deals"')
    expect(portal).toContain('href: "/portal/pursuits"')
    expect(sidebar).toContain('href: "/opportunities/pursuits"')
  })
})
