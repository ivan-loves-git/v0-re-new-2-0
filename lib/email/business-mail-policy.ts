/** #247: the catalogue is a policy index, never authority for a business event. */
export type BusinessEmailCategory = "status" | "intake" | "offer" | "ma"
export const BUSINESS_STAFF_CC = ["bertrand.galas@edu.escp.eu", "colin.hofman@edu.escp.eu"] as const
export const ACCESS_EMAIL_KEYS = ["portal_access_setup", "password_reset"] as const
export function businessCategory(key: string): BusinessEmailCategory | null {
  if ((ACCESS_EMAIL_KEYS as readonly string[]).includes(key)) return null
  if (
    key.startsWith("ma_") ||
    key.startsWith("code:") ||
    /opportunity|recommendation|interest|memo/.test(key)
  )
    return "ma"
  if (
    [
      "welcome",
      "welcome_legacy",
      "form_step_complete",
      "abandoned_reminder",
      "thank_you",
      "high_score_alert",
      "booking_reminder",
    ].includes(key)
  )
    return "intake"
  if (["offer_received", "offer_accepted", "offer_activated", "milestone_completed"].includes(key))
    return "offer"
  return "status"
}
export function businessCc(
  to: string[],
  existing: string[] = [],
  canonical: readonly string[] = BUSINESS_STAFF_CC,
): string[] {
  const primary = new Set(to.map((value) => value.trim().toLowerCase()))
  return [
    ...new Set(
      [...existing, ...canonical]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value && !primary.has(value)),
    ),
  ]
}
export function trackingReadiness(input: {
  businessFrom?: string
  accessFrom?: string
  verifiedAt?: string
  trackingDomain?: string
}) {
  const domain = (value?: string) => value?.match(/@([^>\s]+)>?$/)?.[1]?.toLowerCase()
  const separate =
    !!domain(input.businessFrom) &&
    !!domain(input.accessFrom) &&
    domain(input.businessFrom) !== domain(input.accessFrom)
  const verified =
    separate &&
    !!input.trackingDomain?.trim() &&
    !!input.verifiedAt &&
    Number.isFinite(Date.parse(input.verifiedAt))
  return {
    verified,
    verifiedAt: verified ? input.verifiedAt! : null,
    reason: verified
      ? "Verified future business tracking; access uses an untracked sending domain."
      : "Not measured. Business tracking requires verified domain settings, DNS and a separate untracked access sender.",
  }
}
export function escapeEmailHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  )
}
export function plainEmailHtml(text: string) {
  const prose = text
    .split(/(https?:\/\/[^\s<>"\])]+)/g)
    .map((part) => {
      const escaped = escapeEmailHtml(part)
      return /^https?:\/\//.test(part) ? `<a href="${escaped}">${escaped}</a>` : escaped
    })
    .join("")
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;max-width:600px"><p>${prose.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p></div>`
}
export function protectedEmailLinks(text: string) {
  return [...new Set(text.match(/https?:\/\/[^\s<>"\])]+/g) ?? [])].sort()
}
export const CODE_EMAIL_CATALOGUE = [
  {
    key: "welcome_legacy",
    name: "Legacy first contact",
    description:
      "First legacy intake step; uses Registration confirmation policy. Individual draft review by default.",
    category: "intake",
    audience: "rep",
    policyKey: "welcome",
  },
  {
    key: "opportunity_memo_available",
    name: "Memo available",
    description:
      "Once after an exact authorized memo grant. Queueing does not grant access or record notification sent.",
    category: "ma",
    audience: "rep",
  },
  {
    key: "locked_opportunity_interest",
    name: "Direct opportunity interest",
    description:
      "Exact new direct interest alert to configured staff; withdrawal and namespace gates remain required.",
    category: "ma",
    audience: "staff",
  },
  {
    key: "code:e4_qualification",
    name: "E4 qualification",
    description:
      "Current mutual-interest validation and intermediary NDA process; controlled attachments and source identity.",
    category: "ma",
    audience: "opp",
    policyKey: "ma_nda_info_memo_request",
  },
  {
    key: "code:e6_nda_ready",
    name: "E6 NDA ready",
    description:
      "Exact current validated blank NDA available to its repreneur; no document access is granted by sending.",
    category: "ma",
    audience: "rep",
  },
  {
    key: "code:e7_signed_copies",
    name: "E7 signed copies",
    description:
      "Exact validated signed PDFs to the current intermediary; attachment identity cannot be edited.",
    category: "ma",
    audience: "opp",
    policyKey: "ma_nda_info_memo_request",
  },
  {
    key: "code:source_freshness",
    name: "Grouped source freshness",
    description:
      "One frozen eligible group per intermediary, preserving exact member and episode checks.",
    category: "ma",
    audience: "opp",
    policyKey: "ma_opportunity_validity_check",
  },
  {
    key: "portal_access_setup",
    name: "Access and password setup",
    description:
      "Automatic personal setup invitations (one-hour or seven-day variants). Locked, no staff CC, untracked access links.",
    category: "system",
    audience: "rep",
    locked: true,
  },
  {
    key: "password_reset",
    name: "Password reset",
    description:
      "Automatic personal reset requested by the account owner. Locked, no staff CC, unchanged expiry and token checks.",
    category: "system",
    audience: "rep",
    locked: true,
  },
  {
    key: "code:critical_operation_alert",
    name: "Technical operation alert",
    description:
      "Code-governed privacy-safe technical incident alert to configured operators. System alert; outside business analytics.",
    category: "system",
    audience: "staff",
    locked: true,
  },
] as const
