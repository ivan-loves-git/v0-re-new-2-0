import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

export const JOURNEY_STEPS = [
  { key: "proposed", phase: "interest", label: "Opportunity proposed", explanation: "A response can be sent while this proposal remains open." },
  { key: "response", phase: "interest", label: "Your response", explanation: "Your interest is a request for Re-New to review, not an active pursuit." },
  { key: "confirmed", phase: "interest", label: "Interest confirmed", explanation: "The active discussion follows Re-New's mutual-interest process." },
  { key: "nda_ready", phase: "confidentiality", label: "NDA ready", explanation: "The current NDA template is available after the specific ready-to-sign notice." },
  { key: "nda_submitted", phase: "confidentiality", label: "Signed copy submitted", explanation: "A submitted copy waits for Re-New review. Submission does not validate the NDA." },
  { key: "nda_signed", phase: "confidentiality", label: "NDA signed stage", explanation: "This is the current business stage only. Document validation and access use separate checks." },
  { key: "memo", phase: "confidentiality", label: "Information memorandum", explanation: "The exact current grant makes the IM available; availability does not mean it was read." },
  { key: "qa", phase: "assessment", label: "Q&A with M&A firm", explanation: "The current business stage; individual questions and replies are not recorded here." },
  { key: "intermediary", phase: "assessment", label: "Intermediary meeting", explanation: "The current business stage does not establish a meeting date or attendance." },
  { key: "seller", phase: "assessment", label: "Seller meeting", explanation: "The current business stage does not establish a meeting date or attendance." },
  { key: "valuation", phase: "assessment", label: "Valuation", explanation: "A future process step. WAVE does not yet record a valuation milestone." },
  { key: "loi", phase: "transaction", label: "Letter of intent", explanation: "This business stage does not establish a drafted, submitted, accepted or signed LOI." },
  { key: "audits", phase: "transaction", label: "Audits", explanation: "A future process step. No audit milestone is inferred from the current stage." },
  { key: "financing", phase: "transaction", label: "Financing", explanation: "A future process step. No financing milestone is inferred from the current stage." },
  { key: "closing", phase: "transaction", label: "Closing", explanation: "A future process step. A closed label does not prove an acquisition closed." },
] as const

export type JourneyStepKey = (typeof JOURNEY_STEPS)[number]["key"]
export type JourneyStepState = "recorded" | "current" | "unknown" | "future" | "outcome"
export type JourneyPhase = (typeof JOURNEY_STEPS)[number]["phase"]
export interface PortalJourneyViewStep {
  key: JourneyStepKey
  phase: JourneyPhase
  label: (typeof JOURNEY_STEPS)[number]["label"]
  explanation: (typeof JOURNEY_STEPS)[number]["explanation"]
  state: JourneyStepState
  date: string | null
  role: "renew" | null
}

type JourneyOpportunity = Pick<RepreneurDealFlowOpportunity,
  "match_status" | "pursuit_stage" | "pursuit_stage_provenance" | "interest_expressed_at" | "interest_rejected">

export type JourneyPosition = "earlier" | "current" | "ahead" | "unavailable"
export interface PortalJourneyProgressStep extends PortalJourneyViewStep {
  position: JourneyPosition
}

/**
 * A linear position indicator, not a completion ledger. Current document work
 * can refine an early operating stage; it cannot pull a later stage backwards.
 * Earlier blue positions never change evidence, dates, stages or permissions.
 */
export function buildPortalJourneyProgress(
  opportunity: JourneyOpportunity,
  pursuit: PortalCurrentPursuit | null,
): PortalJourneyProgressStep[] {
  const steps = buildPortalJourneyView(opportunity, pursuit)
  const terminalStage = opportunity.pursuit_stage === "closed" || opportunity.pursuit_stage === "dropped"
  const currentIndex = terminalStage ? -1 : steps.reduce((latest, step, index) => step.state === "current" ? index : latest, -1)
  return steps.map((step, index) => ({
    ...step,
    position: currentIndex < 0 ? "unavailable" : index < currentIndex ? "earlier" : index === currentIndex ? "current" : "ahead",
  }))
}

/** Presentation only. Every recorded state comes from an existing owner-safe consequence. */
export function buildPortalJourneyView(
  opportunity: JourneyOpportunity,
  pursuit: PortalCurrentPursuit | null,
): PortalJourneyViewStep[] {
  const active = opportunity.match_status === "active_pursuit"
  const readable = active && pursuit && !pursuit.projectionUnavailable
  const stage = active ? opportunity.pursuit_stage : null
  const outcome = opportunity.match_status === "withdrawn" || opportunity.match_status === "declined"
    || opportunity.match_status === "dropped" || (opportunity.match_status === "interested" && opportunity.interest_rejected)
  const responseRecorded = Boolean(opportunity.interest_expressed_at) && (
    opportunity.match_status === "interested" || active
  )

  return JOURNEY_STEPS.map((step): PortalJourneyViewStep => {
    let state: JourneyStepState = "unknown"
    let date: string | null = null
    let role: PortalJourneyViewStep["role"] = null
    switch (step.key) {
      case "proposed":
        state = opportunity.match_status === "proposed" ? "current" : "unknown"
        break
      case "response":
        if (outcome) state = "outcome"
        else if (opportunity.match_status === "interested") state = "current"
        else if (responseRecorded) state = "recorded"
        if (responseRecorded) {
          date = opportunity.interest_expressed_at ?? null
        }
        break
      case "confirmed":
        if (active) {
          state = stage === "interest" ? "current"
            : readable && pursuit.history.currentCycleRecorded ? "recorded" : "unknown"
          role = state === "recorded" ? "renew" : null
        }
        break
      case "nda_ready":
        if (readable && pursuit.history.ndaReadyNoticeRecorded) {
          state = pursuit.action === "sign_nda" ? "current" : "recorded"
          role = "renew"
        }
        break
      case "nda_submitted":
        if (readable && pursuit.history.currentSubmissionRecorded) {
          state = pursuit.signedCopyState === "awaiting_validation" ? "current" : "recorded"
        }
        break
      case "nda_signed":
        state = stage === "nda_signed" ? "current" : "unknown"
        break
      case "memo":
        if (readable && pursuit.confidentialGrant && !pursuit.revoked) {
          state = "current"
          date = pursuit.confidentialGrant.grantedAt
          role = "renew"
        } else if (readable && pursuit.history.accessEnded) state = "outcome"
        else if (stage === "info_memo_received") state = "current"
        break
      case "qa":
        state = stage === "qa_with_ma_firm" ? "current" : "unknown"
        break
      case "intermediary":
        state = stage === "intermediary_meeting" ? "current" : "unknown"
        break
      case "seller":
        state = stage === "seller_meeting" ? "current" : "unknown"
        break
      case "loi":
        state = stage === "loi" ? "current" : "unknown"
        break
      case "valuation":
      case "audits":
      case "financing":
      case "closing":
        state = "future"
        break
    }
    return { ...step, state, date, role }
  })
}
