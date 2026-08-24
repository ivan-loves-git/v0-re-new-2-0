import { readFileSync, readdirSync } from "node:fs"
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

type PrivilegedBoundary =
  | "staff"
  | "portal_owner"
  | "authenticated_capability"
  | "webhook"
  | "cron"
  | "public"

const serviceRoleBoundaryInventory: Record<string, PrivilegedBoundary> = {
  "app/(dashboard)/dashboard_op/page.tsx": "staff",
  "app/(dashboard)/opportunities/[id]/documents/[documentId]/route.ts": "staff",
  "app/(dashboard)/opportunities/[id]/nda-artifacts/[artifactId]/route.ts": "staff",
  "app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route.ts": "staff",
  "app/api/cron/abandoned-forms/route.ts": "cron",
  "app/api/external-pursuits/[pursuitId]/attachments/[attachmentId]/route.ts": "portal_owner",
  "app/api/repreneurs/[id]/documents/[documentType]/route.ts": "portal_owner",
  "app/api/repreneurs/[id]/route.ts": "staff",
  "app/api/scrapbook/review-read/route.ts": "staff",
  "app/api/scrapbook/review/route.ts": "staff",
  "app/api/upload-cv/route.ts": "authenticated_capability",
  "app/api/wave-ai/repreneurs/route.ts": "staff",
  "app/api/wavy/suggestions/route.ts": "staff",
  "app/api/webhooks/resend/route.ts": "webhook",
  "app/c/[slug]/page.tsx": "public",
  "app/portal/deals/[matchId]/documents/[documentId]/route.ts": "portal_owner",
  "app/portal/deals/[matchId]/nda-template/route.ts": "portal_owner",
  "app/scrapbook-html-page.tsx": "staff",
  "app/scrapbook/page.tsx": "staff",
  "lib/actions/activities.ts": "staff",
  "lib/actions/analytics.ts": "staff",
  "lib/actions/emails.ts": "staff",
  "lib/actions/evaluation-criteria.ts": "staff",
  "lib/actions/external-pursuit-attachments.ts": "portal_owner",
  "lib/actions/external-pursuit-board.ts": "staff",
  "lib/actions/external-pursuit-capacity.ts": "portal_owner",
  "lib/actions/external-pursuit-conversion.ts": "staff",
  "lib/actions/external-pursuits.ts": "portal_owner",
  "lib/actions/intake-v2.ts": "public",
  "lib/actions/intake.ts": "public",
  "lib/actions/leadership-assessment.ts": "authenticated_capability",
  "lib/actions/ma-contact-email-policy.ts": "staff",
  "lib/actions/ma-relationship-workspaces.ts": "staff",
  "lib/actions/ma-relationships.ts": "staff",
  "lib/actions/ma-sources.ts": "staff",
  "lib/actions/ma-workflows.ts": "staff",
  "lib/actions/offers.ts": "staff",
  "lib/actions/opportunities.ts": "staff",
  "lib/actions/opportunity-analytics.ts": "staff",
  "lib/actions/opportunity-documents.ts": "staff",
  "lib/actions/opportunity-freshness.ts": "staff",
  "lib/actions/opportunity-intake.ts": "staff",
  "lib/actions/opportunity-matches.ts": "staff",
  "lib/actions/opportunity-nda-artifacts.ts": "staff",
  "lib/actions/opportunity-pursuit-journey.ts": "staff",
  "lib/actions/pipeline.ts": "staff",
  "lib/actions/portal-access.ts": "staff",
  "lib/actions/portal-pursuit-nda.ts": "portal_owner",
  "lib/actions/repreneur-opportunities.ts": "portal_owner",
  "lib/actions/repreneur-opportunity-responses.ts": "portal_owner",
  "lib/actions/repreneur-portal-preview.ts": "staff",
  "lib/actions/repreneur-profile.ts": "portal_owner",
  "lib/actions/repreneurs.ts": "staff",
  "lib/actions/waitlist-review.ts": "staff",
  "lib/actions/waitlist.ts": "public",
  "lib/actions/wave-ai.ts": "staff",
}

function filesWithServiceRole(root: string): string[] {
  const absoluteRoot = `${platformRoot}/${root}`
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${root}/${entry.name}`
    if (entry.isDirectory()) return filesWithServiceRole(relativePath)
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) return []
    return source(relativePath).includes("createAdminClient(") ? [relativePath] : []
  })
}

function expectBoundaryMarker(relativePath: string, boundary: PrivilegedBoundary) {
  const fileSource = source(relativePath)
  const markers: Record<Exclude<PrivilegedBoundary, "public">, string[]> = {
    staff: ["requireStaffAccess", 'access.role !== "staff"'],
    portal_owner: [
      "requirePortalAccess",
      "currentActor",
      "async function actor",
      "access.repreneurId",
      "getCurrentUserAccessFromHeaders",
      "resolvePortalPursuitResource",
    ],
    authenticated_capability: [
      "getCurrentUserAccess",
      "verifyAndConsumeIntakeUploadToken",
      "token",
    ],
    webhook: ["verifyWebhookSignature"],
    cron: ["CRON_SECRET"],
  }
  if (boundary === "public") return
  if (
    boundary === "staff" &&
    relativePath.startsWith("app/(dashboard)/") &&
    source("app/(dashboard)/layout.tsx").includes("requireStaffAccess")
  ) {
    return
  }
  expect(
    markers[boundary].some((marker) => fileSource.includes(marker)),
    `${relativePath} must retain its ${boundary} boundary marker`,
  ).toBe(true)
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

  it("classifies every browser-reachable service-role sink and fails closed for new ones", () => {
    const discovered = [
      ...filesWithServiceRole("app"),
      ...filesWithServiceRole("lib/actions"),
    ].sort()
    const inventoried = Object.keys(serviceRoleBoundaryInventory).sort()

    expect(discovered).toEqual(inventoried)
    for (const [relativePath, boundary] of Object.entries(
      serviceRoleBoundaryInventory,
    )) {
      expectBoundaryMarker(relativePath, boundary)
    }
  })

  it("checks staff authorization before creating the admin client in the CRM API route", () => {
    const route = functionSource("app/api/repreneurs/[id]/route.ts", "GET")
    expect(route.indexOf("getCurrentUserAccess")).toBeLessThan(
      route.indexOf("createAdminClient"),
    )
    expect(route.indexOf('access.role !== "staff"')).toBeLessThan(
      route.indexOf("createAdminClient"),
    )
  })
})
