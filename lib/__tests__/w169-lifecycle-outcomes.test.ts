import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  isOpportunityClosureReason,
  isOpportunityPauseReason,
  isOpportunityPursuitDropReason,
  OPPORTUNITY_CLOSURE_REASON_OPTIONS,
  OPPORTUNITY_PAUSE_REASON_OPTIONS,
  OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS,
} from "@/lib/types/opportunity"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

describe("W-169 lifecycle outcome separation", () => {
  const migration = source(
    "supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql",
  )
  const pauseGuardMigration = source(
    "supabase/migrations/20260829203000_w169_pause_guard_scope.sql",
  )
  const rehearsal = source("scripts/rehearse-w169-lifecycle-outcomes.sh")
  const opportunityActions = source("lib/actions/opportunities.ts")
  const pursuitActions = source("lib/actions/opportunity-pursuit-journey.ts")
  const matchActions = source("lib/actions/opportunity-matches.ts")
  const closureControls = source(
    "components/opportunities/opportunity-closure-controls.tsx",
  )
  const pursuitPanel = source(
    "components/opportunities/opportunity-pursuit-panel.tsx",
  )
  const matchesPanel = source(
    "components/opportunities/opportunity-matches-panel.tsx",
  )

  it("exposes disjoint canonical reason sets", () => {
    expect(OPPORTUNITY_CLOSURE_REASON_OPTIONS.map(({ value }) => value)).toEqual([
      "stale",
      "sold",
      "signed_repreneur",
      "withdrawn_seller",
      "duplicate",
      "dd_disqualified",
    ])
    expect(OPPORTUNITY_PAUSE_REASON_OPTIONS.map(({ value }) => value)).toEqual([
      "paused_cabinet",
    ])
    expect(
      OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS.map(({ value }) => value),
    ).toEqual(["no_viable_match", "dd_disqualified_repreneur"])

    expect(isOpportunityClosureReason("paused_cabinet")).toBe(false)
    expect(isOpportunityClosureReason("no_viable_match")).toBe(false)
    expect(isOpportunityClosureReason("dd_disqualified")).toBe(true)
    expect(isOpportunityPauseReason("paused_cabinet")).toBe(true)
    expect(isOpportunityPauseReason("stale")).toBe(false)
    expect(isOpportunityPursuitDropReason("no_viable_match")).toBe(true)
    expect(isOpportunityPursuitDropReason("dd_disqualified_repreneur")).toBe(
      true,
    )
    expect(isOpportunityPursuitDropReason("dd_disqualified")).toBe(false)
    expect(
      OPPORTUNITY_CLOSURE_REASON_OPTIONS.find(
        ({ value }) => value === "dd_disqualified",
      )?.label,
    ).toBe("Due diligence — deal unsuitable for every repreneur")
  })

  it("routes permanent closure and temporary pause through separate staff seams", () => {
    expect(opportunityActions).toContain("export async function closeOpportunity")
    expect(opportunityActions).toContain('supabase.rpc("close_opportunity_with_reason"')
    expect(opportunityActions).toContain("export async function pauseOpportunity")
    expect(opportunityActions).toContain('supabase.rpc("pause_opportunity_with_reason"')
    expect(opportunityActions).toContain("export async function getOpportunityPauseHistory")
    expect(closureControls).toContain("Close opportunity permanently")
    expect(closureControls).toContain("Pause opportunity")
    expect(closureControls).toContain("Pause history")
  })

  it("requires a canonical reason on both staff pursuit Drop paths", () => {
    expect(pursuitActions).toContain("isOpportunityPursuitDropReason(input.reason)")
    expect(matchActions).toContain("isOpportunityPursuitDropReason(reason)")
    expect(pursuitPanel).toContain("OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS")
    expect(matchesPanel).toContain("OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS")
    expect(pursuitPanel).not.toContain(
      'placeholder="Record the external outcome" /></div><Button disabled={pending || !outcomeReason.trim()} variant="destructive"',
    )
    expect(matchesPanel).toContain("Choose why this pursuit is ending")
  })

  it("adds database authority without rewriting historical rows", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.opportunity_pause_history",
    )
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.pause_opportunity_with_reason",
    )
    expect(migration).toContain("opportunity_pause_history_is_immutable")
    expect(migration).toContain("opportunity_pause_reason_required")
    expect(migration).toContain("opportunity_closure_reason_not_permanent")
    expect(migration).toContain("pursuit_drop_reason_required")
    expect(migration).toContain("pursuit_drop_reason_invalid")
    expect(migration).toContain(
      "'dropped',p_actor,p_idempotency_key,NULL,NULL,p_closure_reason",
    )
    expect(migration).not.toMatch(/UPDATE\s+public\.opportunity_closure_history/i)
    expect(migration).not.toMatch(/UPDATE\s+public\.opportunity_pursuit_evidence/i)
  })

  it("rehearses historical preservation, enforcement, and one-pursuit effects", () => {
    expect(rehearsal).toContain("771_public_schema.sql")
    expect(rehearsal).toContain(
      "20260829180000_w169_lifecycle_outcome_separation.sql",
    )
    for (const proof of [
      "w169_historical_closure_changed",
      "w169_historical_drop_changed",
      "w169_cross_category_close_allowed",
      "w169_unreasoned_pause_allowed",
      "w169_direct_pause_bypass_allowed",
      "w169_direct_paused_insert_allowed",
      "w169_pause_not_recorded_once",
      "w169_pause_guard_leaked_after_service",
      "w169_unreasoned_drop_allowed",
      "w169_invalid_drop_reason_allowed",
      "w169_drop_changed_opportunity",
      "w169_drop_reason_not_recorded",
      "w169_drop_retry_duplicated",
      "w169_non_service_role_execute_allowed",
    ]) {
      expect(rehearsal).toContain(proof)
    }
    expect(rehearsal).toContain("20260829203000_w169_pause_guard_scope.sql")
    expect(pauseGuardMigration).toContain("v_previous_transition_flag")
    expect(pauseGuardMigration).toContain(
      "COALESCE(v_previous_transition_flag, '')",
    )
  })
})
