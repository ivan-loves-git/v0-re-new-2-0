import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { PursuitJourneyHistory, PursuitJourneyProgress } from "@/components/portal/pursuit-journey"
import { buildPortalJourneyProgress, buildPortalJourneyView } from "@/lib/portal-pursuit-journey"
import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

const opportunity: Pick<RepreneurDealFlowOpportunity,
  "match_status" | "pursuit_stage" | "pursuit_stage_provenance" | "interest_expressed_at" | "interest_rejected"> = {
  match_status: "active_pursuit", pursuit_stage: "interest", interest_expressed_at: "2026-09-25T10:00:00Z",
}
const pursuit: PortalCurrentPursuit = {
  matchId: "own-match", enabled: true, ndaReadyNotified: true, revoked: false,
  projectionUnavailable: false, action: "sign_nda", signedCopyState: "not_submitted",
  sourceDisclosureCurrent: false, confidentialGrant: null,
  history: { currentCycleRecorded: true, previousCycleEnded: false, ndaReadyNoticeRecorded: true, currentSubmissionRecorded: false, accessEnded: false },
}
const state = (steps: ReturnType<typeof buildPortalJourneyView>, key: string) => steps.find((step) => step.key === key)

describe("owner-safe pursuit journey", () => {
  it("shows one current process position while keeping earlier evidence truthful", () => {
    const progress = buildPortalJourneyProgress(opportunity, pursuit)
    expect(progress.filter((step) => step.position === "current").map((step) => step.key)).toEqual(["nda_ready"])
    expect(progress.filter((step) => step.position === "earlier").map((step) => step.key)).toEqual(["proposed", "response", "confirmed"])
    expect(progress.find((step) => step.key === "proposed")).toMatchObject({ state: "unknown", date: null })
    expect(progress.find((step) => step.key === "nda_submitted")?.position).toBe("ahead")
  })

  it("renders one current step in the shared strip in French and English", () => {
    for (const language of ["en", "fr"] as const) {
      const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: language },
        createElement(PursuitJourneyProgress, { opportunity, pursuit, onFullHistory: () => undefined })))
      expect(html.match(/aria-current="step"/g)).toHaveLength(1)
      expect(html).toContain(language === "fr" ? "Étape actuelle" : "Current step")
      expect(html).not.toContain(language === "fr" ? "Étapes consignées" : "Recorded milestones")
    }
  })

  it("keeps advanced business progress ahead of an available document without inventing earlier history", () => {
    const progress = buildPortalJourneyProgress({ ...opportunity, pursuit_stage: "qa_with_ma_firm", pursuit_stage_provenance: "staff_confirmed_history", interest_expressed_at: null }, {
      ...pursuit, action: null,
      confidentialGrant: { informationMemoDocumentId: "exact-im", grantedAt: "2026-09-26T10:00:00Z", source: null },
      history: { ...pursuit.history, currentCycleRecorded: false, ndaReadyNoticeRecorded: false },
    })
    expect(progress.filter((step) => step.position === "current").map((step) => step.key)).toEqual(["qa"])
    expect(progress.filter((step) => step.position === "earlier").map((step) => step.key)).toEqual(["proposed", "response", "confirmed", "nda_ready", "nda_submitted", "nda_signed", "memo"])
    expect(progress.find((step) => step.key === "nda_signed")).toMatchObject({ state: "unknown", date: null })
    expect(progress.find((step) => step.key === "seller")?.position).toBe("ahead")
  })

  it.each(["withdrawn", "declined", "dropped", "completed"] as const)("does not invent an in-progress or closing position for %s", (match_status) => {
    const progress = buildPortalJourneyProgress({ ...opportunity, match_status, pursuit_stage: "closed" }, null)
    expect(progress.every((step) => step.position === "unavailable")).toBe(true)
    expect(progress.find((step) => step.key === "closing")?.state).toBe("future")
  })

  it("keeps the current business position when documents are unavailable", () => {
    const progress = buildPortalJourneyProgress({ ...opportunity, pursuit_stage: "info_memo_received" }, {
      ...pursuit, action: null, projectionUnavailable: true, confidentialGrant: null,
    })
    expect(progress.filter((step) => step.position === "current").map((step) => step.key)).toEqual(["memo"])
    expect(progress.find((step) => step.key === "memo")?.date).toBeNull()
  })

  it("shows only exact owner-visible consequences and leaves unsupported history unknown", () => {
    const steps = buildPortalJourneyView(opportunity, pursuit)
    expect(state(steps, "response")).toMatchObject({ state: "recorded", date: "2026-09-25T10:00:00Z", role: null })
    expect(state(steps, "confirmed")).toMatchObject({ state: "current", date: null })
    expect(state(steps, "nda_ready")).toMatchObject({ state: "current", date: null })
    expect(state(steps, "nda_submitted")).toMatchObject({ state: "unknown", date: null })
    expect(state(steps, "memo")).toMatchObject({ state: "unknown", date: null })
    expect(state(steps, "closing")).toMatchObject({ state: "future", date: null })
  })

  it("does not complete earlier steps from an advanced staff-confirmed operating stage", () => {
    const steps = buildPortalJourneyView({ ...opportunity, pursuit_stage: "seller_meeting", pursuit_stage_provenance: "staff_confirmed_history" }, {
      ...pursuit, action: null,
      history: { ...pursuit.history, currentCycleRecorded: false, ndaReadyNoticeRecorded: false },
    })
    expect(state(steps, "seller")?.state).toBe("current")
    for (const key of ["confirmed", "nda_ready", "nda_submitted", "nda_signed", "memo", "qa", "intermediary"]) {
      expect(state(steps, key)?.state).toBe("unknown")
    }
  })

  it("separates a current receipt, a signed operating stage and exact IM access", () => {
    const pending = buildPortalJourneyView(opportunity, {
      ...pursuit, action: null, signedCopyState: "awaiting_validation",
      history: { ...pursuit.history, currentSubmissionRecorded: true },
    })
    expect(state(pending, "nda_submitted")?.state).toBe("current")
    expect(state(pending, "nda_submitted")?.role).toBeNull()
    expect(state(pending, "nda_signed")?.state).toBe("unknown")

    const stageOnly = buildPortalJourneyView({ ...opportunity, pursuit_stage: "info_memo_received" }, {
      ...pursuit, action: null, history: { ...pursuit.history, ndaReadyNoticeRecorded: false },
    })
    expect(state(stageOnly, "memo")).toMatchObject({ state: "current", date: null })
    expect(state(stageOnly, "nda_ready")?.state).toBe("unknown")

    const granted = buildPortalJourneyView({ ...opportunity, pursuit_stage: "qa_with_ma_firm" }, {
      ...pursuit, action: null, confidentialGrant: { informationMemoDocumentId: "exact-im", grantedAt: "2026-09-26T10:00:00Z", source: null },
    })
    expect(state(granted, "memo")).toMatchObject({ state: "current", date: "2026-09-26T10:00:00Z" })
    expect(state(granted, "qa")?.state).toBe("current")
    expect(state(granted, "seller")?.state).toBe("unknown")
  })

  it("ends access and keeps withdrawn, declined, dropped and unsupported closing distinct", () => {
    const ended = buildPortalJourneyView(opportunity, { ...pursuit, action: null, revoked: true, confidentialGrant: null,
      history: { ...pursuit.history, accessEnded: true, ndaReadyNoticeRecorded: false } })
    expect(state(ended, "memo")).toMatchObject({ state: "outcome", date: null })
    const endedAtMemoStage = buildPortalJourneyView({ ...opportunity, pursuit_stage: "info_memo_received" }, { ...pursuit, action: null, revoked: true, confidentialGrant: null,
      history: { ...pursuit.history, accessEnded: true, ndaReadyNoticeRecorded: false } })
    expect(state(endedAtMemoStage, "memo")).toMatchObject({ state: "outcome", date: null })
    for (const status of ["withdrawn", "declined", "dropped"] as const) {
      const steps = buildPortalJourneyView({ ...opportunity, match_status: status, pursuit_stage: "closed" }, null)
      expect(state(steps, "response")?.state).toBe(status === "withdrawn" || status === "declined" || status === "dropped" ? "outcome" : "unknown")
      expect(state(steps, "closing")?.state).toBe("future")
      expect(steps.some((step) => step.state === "recorded")).toBe(false)
    }
    const unsupported = buildPortalJourneyView({ ...opportunity, match_status: "completed", pursuit_stage: "closed" }, null)
    expect(state(unsupported, "closing")?.state).toBe("future")
    expect(unsupported.some((step) => step.state === "current")).toBe(false)
  })

  it("renders French and English help, future context and unknown dates without private audit data", () => {
    for (const [language, title] of [["en", "Journey &amp; history"], ["fr", "Parcours et historique"]] as const) {
      const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: language },
        createElement("div", null,
          createElement(PursuitJourneyProgress, { opportunity, pursuit, onFullHistory: () => undefined }),
          createElement(PursuitJourneyHistory, { opportunity, pursuit }),
        )))
      expect(html).toContain(title)
      expect(html).toContain('data-wave-progress="true"')
      expect(html).toContain('data-wave-journey="true"')
      expect(html).toContain(language === "fr" ? "Date non consignée" : "Date not recorded")
      expect(html).toContain(language === "fr" ? "Étapes et éléments disponibles" : "Stages and available records")
      expect(html).toContain(language === "fr" ? "Non établi ici" : "Not established here")
      expect(html).not.toMatch(/gate_1|gate_2|actor|metadata|artifact|idempotency|source_firm_id|staff-secret/)
    }
  })

  it("keeps future context in canonical roadmap order without claiming completion", () => {
    const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: "en" },
      createElement(PursuitJourneyHistory, { opportunity: { ...opportunity, pursuit_stage: "qa_with_ma_firm" }, pursuit })))
    expect(html.indexOf("Valuation")).toBeLessThan(html.indexOf("Letter of intent"))
    expect(html).toContain("Future step")
    expect(html).toContain("Not established here")
  })
})
