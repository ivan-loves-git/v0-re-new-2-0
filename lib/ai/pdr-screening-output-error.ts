export const PDR_SCREENING_OUTPUT_FAILURE_REASONS = [
  "provider_parse_failure",
  "provider_incomplete_max_output_tokens",
  "provider_incomplete_content_filter",
  "provider_incomplete_unknown",
  "provider_failed",
  "provider_unparsed",
  "schema_mismatch",
  "goal_milestone_pair",
  "stale_policy",
  "unknown_goal",
  "unknown_milestone",
  "goal_milestone_mismatch",
  "invalid_overlap",
] as const

export type PdrScreeningOutputFailureReason =
  (typeof PDR_SCREENING_OUTPUT_FAILURE_REASONS)[number]

export type PdrScreeningLedgerErrorCode =
  | `invalid_output_${Exclude<PdrScreeningOutputFailureReason, "provider_failed">}`
  | "provider_response_failed"

/** Metadata-only failure. It must never carry prompt or generated content. */
export class PdrScreeningOutputError extends SyntaxError {
  constructor(public readonly reason: PdrScreeningOutputFailureReason) {
    super("Invalid PDR screening output")
    this.name = "PdrScreeningOutputError"
  }
}

export function pdrScreeningLedgerErrorCode(
  cause: unknown,
): PdrScreeningLedgerErrorCode | null {
  return cause instanceof PdrScreeningOutputError
    ? cause.reason === "provider_failed"
      ? "provider_response_failed"
      : `invalid_output_${cause.reason}`
    : null
}
