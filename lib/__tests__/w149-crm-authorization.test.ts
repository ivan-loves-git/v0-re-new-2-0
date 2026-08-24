import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { createActivity, deleteActivity } from "@/lib/actions/activities"
import { updateCriterion } from "@/lib/actions/evaluation-criteria"
import { updateRepreneurStatusPipeline } from "@/lib/actions/pipeline"
import { updateRepreneurStatus } from "@/lib/actions/repreneurs"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

function functionSource(relativePath: string, functionName: string) {
  const fileSource = source(relativePath)
  const start = fileSource.indexOf(`export async function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextExport = fileSource.indexOf("\nexport async function", start + 1)
  return fileSource.slice(start, nextExport === -1 ? fileSource.length : nextExport)
}

function expectStaffBeforeServiceRole(
  relativePath: string,
  functionName: string,
) {
  const action = functionSource(relativePath, functionName)
  const guardIndex = action.indexOf("requireStaffAccess")
  const clientIndex = action.indexOf("createAdminClient")
  expect(guardIndex).toBeGreaterThanOrEqual(0)
  expect(clientIndex).toBeGreaterThanOrEqual(0)
  expect(guardIndex).toBeLessThan(clientIndex)
}

describe("W-149 CRM authorization boundaries", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset()
    mocks.requireStaffAccess.mockReset()
  })

  it.each(["unauthenticated", "repreneur", "unassigned"])(
    "denies %s callers before service-role access, including arbitrary and cross-repreneur IDs",
    async (persona) => {
      mocks.requireStaffAccess.mockRejectedValue(
        new Error(`${persona} caller denied`),
      )

      await expect(
        updateRepreneurStatus("other-repreneur-id", "client"),
      ).rejects.toThrow(`${persona} caller denied`)
      await expect(
        updateRepreneurStatusPipeline("other-repreneur-id", "declined"),
      ).rejects.toThrow(`${persona} caller denied`)
      await expect(
        createActivity("other-repreneur-id", "interview"),
      ).rejects.toThrow(`${persona} caller denied`)
      await expect(
        deleteActivity("victim-activity-id", "other-repreneur-id"),
      ).rejects.toThrow(`${persona} caller denied`)
      await expect(
        updateCriterion("victim-criterion-id", { option_score: 100 }),
      ).rejects.toThrow(`${persona} caller denied`)

      expect(mocks.createAdminClient).not.toHaveBeenCalled()
    },
  )

  it("requires staff access before every legacy CRM service-role operation", () => {
    for (const functionName of [
      "createRepreneur",
      "updateRepreneur",
      "updateRepreneurStatus",
      "updateRepreneurJourneyStage",
      "updateRepreneurField",
      "updateRepreneurIdentity",
      "createNote",
      "deleteNote",
      "deleteRepreneur",
      "setTier2Stars",
      "clearTier2Stars",
      "rejectRepreneur",
      "unrejectRepreneur",
      "declineRepreneur",
      "undeclineRepreneur",
      "getExportEnrichmentData",
      "saveAccuracyRating",
      "saveQuestionnaire",
      "updateTier1Answer",
      "updateTier1Answers",
      "setTier2Dimensions",
      "toggleMilestone",
      "saveQuestionnaireV2",
    ]) {
      expectStaffBeforeServiceRole("lib/actions/repreneurs.ts", functionName)
    }
  })

  it("requires staff access before activity, pipeline, and scoring-policy operations", () => {
    for (const functionName of [
      "createActivity",
      "getActivities",
      "deleteActivity",
    ]) {
      expectStaffBeforeServiceRole("lib/actions/activities.ts", functionName)
    }

    expectStaffBeforeServiceRole(
      "lib/actions/pipeline.ts",
      "updateRepreneurStatusPipeline",
    )

    for (const functionName of [
      "updateCriterion",
      "updateQuestionLabel",
      "updateMultipleCriteria",
    ]) {
      expectStaffBeforeServiceRole(
        "lib/actions/evaluation-criteria.ts",
        functionName,
      )
    }
  })

  it("keeps browser-callable legacy CRM modules on the staff-only inventory", () => {
    const inventory = [
      ["components/repreneurs/activity-history.tsx", "@/lib/actions/activities"],
      ["components/pipeline/kanban-board.tsx", "@/lib/actions/pipeline"],
      ["components/repreneurs/update-status-form.tsx", "@/lib/actions/repreneurs"],
      ["components/repreneurs/repreneur-table.tsx", "@/lib/actions/repreneurs"],
      ["components/repreneurs/questionnaire-form.tsx", "@/lib/actions/repreneurs"],
      ["components/repreneurs/repreneur-actions-menu.tsx", "@/lib/actions/repreneurs"],
    ] as const

    for (const [component, actionModule] of inventory) {
      expect(source(component)).toContain(actionModule)
    }
  })
})
