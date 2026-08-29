import { readFileSync, readdirSync } from "node:fs"
import ts from "typescript"
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

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
  return ts
    .getModifiers(node as ts.HasModifiers)
    ?.some((modifier) => modifier.kind === kind)
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

type ServiceRoleExport = {
  boundary: PrivilegedBoundary
  exports: string[]
  overrides?: Partial<Record<string, PrivilegedBoundary>>
}

const boundary = (
  boundary: PrivilegedBoundary,
  exports: string[],
  overrides?: ServiceRoleExport["overrides"],
) => ({
  boundary,
  exports,
  overrides,
})

const serviceRoleBoundaryInventory: Record<string, ServiceRoleExport> = {
  "app/(dashboard)/dashboard_op/page.tsx": boundary("staff", ["default"]),
  "app/(dashboard)/journey/page.tsx": boundary("staff", ["default"]),
  "app/(dashboard)/offers/[id]/edit/page.tsx": boundary("staff", ["default"]),
  "app/(dashboard)/offers/page.tsx": boundary("staff", ["default"]),
  "app/(dashboard)/opportunities/[id]/documents/[documentId]/route.ts": boundary("staff", ["GET"]),
  "app/(dashboard)/opportunities/[id]/nda-artifacts/[artifactId]/route.ts": boundary("staff", ["GET"]),
  "app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route.ts": boundary("staff", ["GET"]),
  "app/(dashboard)/repreneurs/[id]/page.tsx": boundary("staff", ["default"]),
  "app/api/cron/abandoned-forms/route.ts": boundary("cron", ["GET"]),
  "app/api/external-pursuits/[pursuitId]/attachments/[attachmentId]/route.ts": boundary("portal_owner", ["GET"]),
  "app/api/repreneurs/[id]/documents/[documentType]/route.ts": boundary("portal_owner", ["GET"]),
  "app/api/repreneurs/[id]/route.ts": boundary("staff", ["GET"]),
  "app/api/reset-avatar/route.ts": boundary("staff", ["POST"]),
  "app/api/scrapbook/review-read/route.ts": boundary("staff", ["GET"]),
  "app/api/scrapbook/review/route.ts": boundary("staff", ["POST"]),
  "app/api/seed/route.ts": boundary("staff", ["POST"]),
  "app/api/upload-cv/route.ts": boundary("authenticated_capability", ["POST", "DELETE"]),
  "app/api/upload-avatar/route.ts": boundary("staff", ["POST"]),
  "app/api/update-journey-stages/route.ts": boundary("staff", ["POST"]),
  "app/api/wave-ai/repreneurs/route.ts": boundary("staff", ["GET"]),
  "app/api/wavy/suggestions/route.ts": boundary("staff", ["GET"]),
  "app/api/webhooks/resend/route.ts": boundary("webhook", ["POST"]),
  "app/c/[slug]/page.tsx": boundary("public", ["default"]),
  "app/portal/deals/[matchId]/documents/[documentId]/route.ts": boundary("portal_owner", ["GET"]),
  "app/portal/deals/[matchId]/nda-template/route.ts": boundary("portal_owner", ["GET"]),
  "app/scrapbook-html-page.tsx": boundary("staff", ["ScrapbookHtmlPage"]),
  "app/scrapbook/page.tsx": boundary("staff", ["default"]),
  "lib/actions/activities.ts": boundary("staff", ["createActivity", "getActivities", "deleteActivity"]),
  "lib/actions/analytics.ts": boundary("staff", ["getAnalyticsData"]),
  "lib/actions/client-pursuit-portfolio.ts": boundary("staff", ["listClientPursuitPortfolio"]),
  "lib/actions/emails.ts": boundary("staff", ["getEmailStats", "getEmailLogs", "getTemplateSettings", "toggleTemplateEnabled", "updateTemplateSettings", "getRenderedTemplate", "getRepreneursForManualSend", "sendManualEmail", "getDailyEmailCounts"]),
  "lib/actions/evaluation-criteria.ts": boundary("staff", ["updateCriterion", "updateQuestionLabel", "updateMultipleCriteria"]),
  "lib/actions/external-pursuit-attachments.ts": boundary("portal_owner", ["getExternalPursuitAttachments", "getExternalPursuitAttachmentMap", "uploadExternalPursuitAttachment", "deleteExternalPursuitAttachment", "fulfillExternalPursuitDeletionWithAttachments"], { fulfillExternalPursuitDeletionWithAttachments: "staff" }),
  "lib/actions/external-pursuit-board.ts": boundary("staff", ["listExternalPursuitOwners"]),
  "lib/actions/external-pursuit-capacity.ts": boundary("authenticated_capability", ["getExternalPursuitCapacitySnapshot", "confirmExternalPursuitCurrent"], { getExternalPursuitCapacitySnapshot: "staff" }),
  "lib/actions/external-pursuit-conversion.ts": boundary("staff", ["convertExternalPursuitToOpportunity", "preflightExternalPursuitDeletionFulfillment", "listUnconvertedExternalPursuitIds"]),
  "lib/actions/external-pursuits.ts": boundary("portal_owner", ["getExternalPursuit", "createExternalPursuit", "updateExternalPursuit", "moveExternalPursuitStage", "listExternalPursuitBoard", "updateExternalPursuitFollowUp", "saveExternalPursuitContact", "requestExternalPursuitDeletion"]),
  "lib/actions/intake-v2.ts": boundary("public", ["submitIntakeV2"]),
  "lib/actions/intake.ts": boundary("public", ["createIntakeDraft", "updateIntakeBackground", "updateIntakeMAExperience", "updateIntakeGoals", "completeIntake"]),
  "lib/actions/leadership-assessment.ts": boundary("authenticated_capability", ["createAssessment", "getAssessmentByToken", "submitAssessment", "getLatestAssessment", "getPendingAssessment"], { createAssessment: "staff", getLatestAssessment: "staff", getPendingAssessment: "staff" }),
  "lib/actions/ma-contact-email-policy.ts": boundary("staff", ["setMaContactCampaignEmailSuppression"]),
  "lib/actions/ma-relationship-workspaces.ts": boundary("staff", [
    "getMaOfficeWorkspace",
    "getMaFirmWorkspace",
    "updateMaContactCorrection",
    "updateMaFirmCorrection",
    "updateMaOfficeCorrection",
    "updateMaRelationshipWorkspaceNotes",
  ]),
  "lib/actions/ma-relationships.ts": boundary("staff", ["getMaRelationshipWorkspace", "createMaRelationshipInteraction", "verifyMaRelationshipInteractionOwner"]),
  "lib/actions/ma-sources.ts": boundary("staff", ["listMaSourceDirectory", "listMaSourceContactsDirectory"]),
  "lib/actions/ma-workflows.ts": boundary("staff", ["getMaOpportunityWorkflow", "sendMaSourceWorkflowEmail", "sendMaSourceWorkflowEmailPayload"]),
  "lib/actions/offers.ts": boundary("staff", ["createOffer", "updateOffer", "toggleOfferActive", "assignOfferToRepreneur", "retryOfferReceivedNotification", "updateRepreneurOfferStatus", "deleteRepreneurOffer", "createMilestone", "toggleMilestoneComplete", "retryMilestoneCompletionNotification", "updateMilestone", "deleteMilestone", "getAllClientOffers"]),
  "lib/actions/opportunities.ts": boundary("staff", [
    "listOpportunities",
    "listOpportunityWorkSurfaceRecords",
    "getOpportunity",
    "getOpportunityClosureHistory",
    "closeOpportunity",
    "archiveOpportunity",
    "setOpportunityDemoClassification",
  ]),
  "lib/actions/opportunity-analytics.ts": boundary("staff", ["getOpportunityKpiData"]),
  "lib/actions/opportunity-documents.ts": boundary("staff", ["listOpportunityDocuments", "registerOpportunityDocument", "updateOpportunityDocumentVisibility", "removeOpportunityDocument", "removeUnusedRetainedOpportunityDocument"]),
  "lib/actions/opportunity-freshness.ts": boundary("staff", ["getOpportunityFreshnessData"]),
  "lib/actions/opportunity-intake.ts": boundary("staff", ["listOpportunityGeographyOptions", "listMaOfficeIntakeOptions", "listMaCanonicalContactOptions", "createOpportunityIntake", "updateOpportunityIntake", "resolveAcmeProvisionalSource", "createMaFirmOfficeContext", "createMaOfficeForExistingFirm", "createMaOfficeContact"]),
  "lib/actions/opportunity-matches.ts": boundary("staff", ["listOpportunityMatches", "listOpportunityMatchesForRepreneur", "listOpportunityPursuitEvents", "listOpportunityMatchResponses", "listOpportunityMatchCandidates", "listOpportunityCandidatesForRepreneur", "saveOpportunityMatch", "removeOpportunityMatch", "markOpportunityMatchReviewed", "validateOpportunityPursuit", "dropOpportunityPursuit", "reopenDroppedOpportunityMatch"]),
  "lib/actions/opportunity-nda-artifacts.ts": boundary("staff", ["listOpportunityNdaArtifacts", "registerOpportunityNdaArtifact"]),
  "lib/actions/opportunity-pursuit-journey.ts": boundary("staff", ["qualifyOpportunityPursuit", "requestOpportunityPursuitQualification", "passOpportunityPursuitGate1", "passOpportunityPursuitGate2", "grantOpportunityPursuitConfidentialAccess", "validateOpportunityPursuitTemplate", "validateOpportunityPursuitSignedCopy", "recordOpportunityPursuitDispatch", "transitionOpportunityPursuit", "runOpportunityPursuitJourneyAction", "startOpportunityPursuit"]),
  "lib/actions/pipeline.ts": boundary("staff", ["updateRepreneurStatusPipeline"]),
  "lib/actions/portal-access.ts": boundary("staff", ["getRepreneurPortalAccessStatus", "enableRepreneurPortalAccess", "disableRepreneurPortalAccess", "resendRepreneurPortalAccessLink"]),
  "lib/actions/portal-pursuit-nda.ts": boundary("portal_owner", ["submitPortalPursuitSignedNda"]),
  "lib/actions/repreneur-opportunities.ts": boundary("portal_owner", ["listMyRepreneurOpportunities", "listMyRepreneurDealFlow", "getMyRepreneurOpportunity"]),
  "lib/actions/repreneur-opportunity-responses.ts": boundary("portal_owner", ["markMyOpportunityInterested", "declineMyOpportunity"]),
  "lib/actions/repreneur-portal-preview.ts": boundary("staff", ["listStaffPortalPreviewOptions", "getStaffPortalPreviewProfile", "listStaffPortalPreviewOpportunities", "getStaffPortalPreviewOpportunity"]),
  "lib/actions/repreneur-profile.ts": boundary("portal_owner", ["getMyRepreneurProfile", "certifyMyProfileContribution", "updateMyTargetThesis", "updateRepreneurTargetThesis"], { updateRepreneurTargetThesis: "staff" }),
  "lib/actions/repreneurs.ts": boundary("staff", ["createRepreneur", "updateRepreneur", "updateRepreneurStatus", "updateRepreneurJourneyStage", "updateRepreneurField", "updateRepreneurIdentity", "setRepreneurDemoClassification", "createNote", "deleteNote", "deleteRepreneur", "setTier2Stars", "clearTier2Stars", "rejectRepreneur", "unrejectRepreneur", "declineRepreneur", "undeclineRepreneur", "getExportEnrichmentData", "saveAccuracyRating", "saveQuestionnaire", "updateTier1Answer", "updateTier1Answers", "setTier2Dimensions", "toggleMilestone", "saveQuestionnaireV2"]),
  "lib/actions/waitlist-review.ts": boundary("staff", ["getWaitlistReviewRequests", "promoteWaitlistRepreneur"]),
  "lib/actions/waitlist.ts": boundary("public", ["submitWaitlistRequest"]),
  "lib/actions/wave-ai.ts": boundary("staff", ["getWaveAiCustomTemplates", "getFollowUpSuggestions"]),
}

function parsedSource(relativePath: string) {
  return ts.createSourceFile(
    relativePath,
    source(relativePath),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function serviceRoleFactoryNames(relativePath: string, parsed = parsedSource(relativePath)) {
  const names = new Set<string>()
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const moduleName = statement.moduleSpecifier.text
    if (moduleName !== "@/lib/supabase/admin" && moduleName !== "@/lib/supabase/server") continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text
      if (
        (moduleName.endsWith("/admin") && imported === "createAdminClient") ||
        (moduleName.endsWith("/server") && ["createServerClient", "createClient"].includes(imported))
      ) {
        names.add(element.name.text)
      }
    }
  }
  return names
}

function containsFactoryCall(node: ts.Node, factories: Set<string>) {
  let found = false
  const visit = (candidate: ts.Node) => {
    if (
      ts.isCallExpression(candidate) &&
      ts.isIdentifier(candidate.expression) &&
      factories.has(candidate.expression.text)
    ) {
      found = true
      return
    }
    candidate.forEachChild(visit)
  }
  visit(node)
  return found
}

function filesWithServiceRole(root: string): string[] {
  const absoluteRoot = `${platformRoot}/${root}`
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${root}/${entry.name}`
    if (entry.isDirectory()) return filesWithServiceRole(relativePath)
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) return []
    const parsed = parsedSource(relativePath)
    const factories = serviceRoleFactoryNames(relativePath, parsed)
    return factories.size > 0 && containsFactoryCall(parsed, factories)
      ? [relativePath]
      : []
  })
}

function exportedServiceRoleFunctions(relativePath: string): string[] {
  const parsed = parsedSource(relativePath)
  const serviceRoleFactories = serviceRoleFactoryNames(relativePath, parsed)
  const localFunctions = new Map<string, string>()
  const exported = new Map<string, string>()

  for (const statement of parsed.statements) {
    const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      const name = isDefault ? "default" : statement.name?.text
      if (name) {
        localFunctions.set(name, statement.body.getText(parsed))
        if (isExported) exported.set(name, statement.body.getText(parsed))
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          const name = declaration.name.text
          const body = declaration.initializer.body.getText(parsed)
          localFunctions.set(name, body)
          if (isExported) exported.set(name, body)
        }
      }
    }
  }

  const reachesServiceRole = (body: string, visited = new Set<string>()): boolean => {
    if ([...serviceRoleFactories].some((factory) => new RegExp(`\\b${factory}\\s*\\(`).test(body))) return true
    return [...localFunctions].some(([name, localBody]) => {
      if (visited.has(name)) return false
      const invoked = new RegExp(`\\b${name}\\b`).test(body)
      return invoked && reachesServiceRole(localBody, new Set([...visited, name]))
    })
  }

  return [...exported]
    .filter(([, body]) => reachesServiceRole(body))
    .map(([name]) => name)
    .sort()
}

function staffBoundaryBeforeEveryServiceRolePath(
  relativePath: string,
  exportName: string,
) {
  if (relativePath.startsWith("app/(dashboard)/")) {
    expect(source("app/(dashboard)/layout.tsx")).toContain("requireStaffAccess")
    return true
  }

  const parsed = parsedSource(relativePath)
  const factories = serviceRoleFactoryNames(relativePath, parsed)
  const localFunctions = new Map<string, ts.FunctionLikeDeclaration>()
  for (const statement of parsed.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      if (statement.name) localFunctions.set(statement.name.text, statement)
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        localFunctions.set("default", statement)
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          localFunctions.set(declaration.name.text, declaration.initializer)
        }
      }
    }
  }

  const root = localFunctions.get(exportName)
  expect(root, `${relativePath} must declare ${exportName}`).toBeDefined()

  const isDenyingStaffGuard = (node: ts.Node) => {
    if (!ts.isIfStatement(node)) return false
    const condition = node.expression.getText(parsed)
    if (!condition.includes("role") || !condition.includes('"staff"')) return false
    return node.thenStatement.getText(parsed).includes("return") ||
      node.thenStatement.getText(parsed).includes("throw")
  }

  const analyze = (
    fn: ts.FunctionLikeDeclaration,
    guardedOnEntry: boolean,
    stack: Set<string>,
  ): { safe: boolean; reachesSink: boolean } => {
    const body = fn.body
    if (!body) return { safe: true, reachesSink: false }
    const events: Array<{
      position: number
      kind: "guard" | "factory" | "local"
      name?: string
    }> = []
    const visit = (node: ts.Node) => {
      if (isDenyingStaffGuard(node)) {
        events.push({ position: node.end, kind: "guard" })
        return
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text
        if (name === "requireStaffAccess") {
          events.push({ position: node.getStart(parsed), kind: "guard" })
        } else if (factories.has(name)) {
          events.push({ position: node.getStart(parsed), kind: "factory" })
        } else if (localFunctions.has(name)) {
          events.push({ position: node.getStart(parsed), kind: "local", name })
        }
      }
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ts.isIdentifier(node.tagName) &&
        localFunctions.has(node.tagName.text)
      ) {
        events.push({
          position: node.getStart(parsed),
          kind: "local",
          name: node.tagName.text,
        })
      }
      node.forEachChild(visit)
    }
    body.forEachChild(visit)
    events.sort((left, right) => left.position - right.position)

    let guarded = guardedOnEntry
    let reachesSink = false
    for (const event of events) {
      if (event.kind === "guard") {
        guarded = true
        continue
      }
      if (event.kind === "factory") {
        reachesSink = true
        if (!guarded) return { safe: false, reachesSink: true }
        continue
      }
      if (event.name && !stack.has(event.name)) {
        const called = localFunctions.get(event.name)
        if (!called) continue
        const result = analyze(called, guarded, new Set([...stack, event.name]))
        reachesSink ||= result.reachesSink
        if (!result.safe) return { safe: false, reachesSink }
      }
    }
    return { safe: true, reachesSink }
  }

  const result = analyze(root!, false, new Set([exportName]))
  expect(result.reachesSink, `${relativePath}#${exportName} must reach a service-role client`).toBe(true)
  return result.safe
}

function expectExportBoundary(
  relativePath: string,
  exportName: string,
  boundary: PrivilegedBoundary,
) {
  const parsed = ts.createSourceFile(
    relativePath,
    source(relativePath),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  let body: string | undefined
  for (const statement of parsed.statements) {
    const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    const name = ts.isFunctionDeclaration(statement)
      ? (isDefault ? "default" : statement.name?.text)
      : undefined
    if (
      ts.isFunctionDeclaration(statement) &&
      isExported &&
      name === exportName &&
      statement.body
    ) {
      body = statement.body.getText(parsed)
      break
    }
    if (isExported && ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(
        (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === exportName,
      )
      if (
        declaration?.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        body = declaration.initializer.body.getText(parsed)
        break
      }
    }
  }
  expect(body, `${relativePath} must export ${exportName}`).toBeDefined()
  if (
    boundary === "authenticated_capability" &&
    !body!.includes("getCurrentUserAccess")
  ) {
    const signature = source(relativePath).slice(
      source(relativePath).indexOf(`export async function ${exportName}`),
      source(relativePath).indexOf("{", source(relativePath).indexOf(`export async function ${exportName}`)),
    )
    expect(signature, `${relativePath}#${exportName} must accept a capability token`).toMatch(/\btoken\b/)
    expect(body, `${relativePath}#${exportName} must bind its token to the privileged query`).toContain('.eq("token", token)')
  }
  const guardMarkers: Record<Exclude<PrivilegedBoundary, "public">, string[]> = {
    staff: ["requireStaffAccess", 'access.role !== "staff"'],
    portal_owner: ["requirePortalAccess", "currentActor", "actor()", "getCurrentRepreneurProfile", "getCurrentRepreneurDealFlowProfile", "async function actor", "access.repreneurId", "getCurrentUserAccessFromHeaders", "resolvePortalPursuitResource"],
    authenticated_capability: ["getCurrentUserAccess", "verifyAndConsumeIntakeUploadToken", "token"],
    webhook: ["verifyWebhookSignature"],
    cron: ["CRON_SECRET"],
  }
  const protectedBody =
    boundary !== "public" && guardMarkers[boundary].some((marker) => body!.includes(marker))
      ? body!
      : firstReachableServiceRoleBody(relativePath, body!)
  expectBoundaryInBody(
    relativePath,
    exportName,
    protectedBody,
    boundary,
  )
}

function firstReachableServiceRoleBody(relativePath: string, exportBody: string) {
  const parsed = ts.createSourceFile(
    relativePath,
    source(relativePath),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const localFunctions = new Map<string, string>()
  for (const statement of parsed.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      localFunctions.set(statement.name.text, statement.body.getText(parsed))
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          localFunctions.set(
            declaration.name.text,
            declaration.initializer.body.getText(parsed),
          )
        }
      }
    }
  }
  const find = (body: string, visited = new Set<string>()): string => {
    if (body.includes("createAdminClient(")) return body
    for (const [name, localBody] of localFunctions) {
      if (
        !visited.has(name) &&
        new RegExp(`\\b${name}\\b`).test(body)
      ) {
        const sinkBody = find(localBody, new Set([...visited, name]))
        if (sinkBody.includes("createAdminClient(")) return sinkBody
      }
    }
    return body
  }
  return find(exportBody)
}

function expectBoundaryInBody(
  relativePath: string,
  exportName: string,
  body: string,
  boundary: PrivilegedBoundary,
) {
  const markers: Record<Exclude<PrivilegedBoundary, "public">, string[]> = {
    staff: ["requireStaffAccess", 'access.role !== "staff"'],
    portal_owner: [
      "requirePortalAccess",
      "currentActor",
      "actor()",
      "getCurrentRepreneurProfile",
      "getCurrentRepreneurDealFlowProfile",
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
    boundary === "authenticated_capability" &&
    body.includes('.eq("token", token)')
  ) {
    return
  }
  if (
    boundary === "staff" &&
    relativePath.startsWith("app/(dashboard)/") &&
    source("app/(dashboard)/layout.tsx").includes("requireStaffAccess")
  ) {
    return
  }
  const firstSink = body.indexOf("createAdminClient(")
  const guardedBeforeSink = markers[boundary].some((marker) => {
    const markerIndex = body.indexOf(marker)
    return markerIndex >= 0 && (firstSink === -1 || markerIndex < firstSink)
  })
  expect(guardedBeforeSink, `${relativePath}#${exportName} must derive its ${boundary} boundary before its service-role sink`).toBe(true)
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
      "setRepreneurDemoClassification",
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

  it("classifies every browser-reachable service-role export and fails closed for new ones", () => {
    const discovered = [
      ...filesWithServiceRole("app"),
      ...filesWithServiceRole("lib/actions"),
    ].sort()
    const inventoried = Object.keys(serviceRoleBoundaryInventory).sort()

    expect(discovered).toEqual(inventoried)
    for (const [relativePath, entry] of Object.entries(
      serviceRoleBoundaryInventory,
    )) {
      expect(exportedServiceRoleFunctions(relativePath), relativePath).toEqual(
        [...entry.exports].sort(),
      )
      for (const exportName of entry.exports) {
        const effectiveBoundary = entry.overrides?.[exportName] ?? entry.boundary
        expectExportBoundary(
          relativePath,
          exportName,
          effectiveBoundary,
        )
        if (effectiveBoundary === "staff") {
          expect(
            staffBoundaryBeforeEveryServiceRolePath(relativePath, exportName),
            `${relativePath}#${exportName} must authorize staff before every service-role path`,
          ).toBe(true)
        }
      }
    }
  })

  it("does not let a guard in one export authorize another export", () => {
    const mixedModule = `
      export async function guarded() {
        await requireStaffAccess()
        createAdminClient()
      }
      export async function unguarded() {
        createAdminClient()
      }
    `
    expectBoundaryInBody("fixture.ts", "guarded", mixedModule.slice(0, mixedModule.indexOf("export async function unguarded")), "staff")
    expect(() =>
      expectBoundaryInBody(
        "fixture.ts",
        "unguarded",
        mixedModule.slice(mixedModule.indexOf("export async function unguarded")),
        "staff",
      ),
    ).toThrow()
  })

  it("rejects a local privileged helper reached before a later guard", () => {
    const relativePath = "lib/__tests__/fixtures/w149-helper-before-guard.fixture.ts"
    expect(
      staffBoundaryBeforeEveryServiceRolePath(relativePath, "guardedFirst"),
    ).toBe(true)
    expect(
      staffBoundaryBeforeEveryServiceRolePath(relativePath, "helperFirst"),
    ).toBe(false)
    expect(
      staffBoundaryBeforeEveryServiceRolePath(relativePath, "commentOnly"),
    ).toBe(false)
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
