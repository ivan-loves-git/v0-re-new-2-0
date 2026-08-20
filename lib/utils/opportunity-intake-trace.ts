import type { CriticalOperationErrorCategory } from "@/lib/observability/critical-operation"

/** Maps only known, safe RPC business rules to a controlled validation trace. */
export function opportunityIntakeTraceCategory(
  error: { message?: string | null },
  knownBusinessRuleCodes: readonly string[],
): CriticalOperationErrorCategory {
  const rawMessage = error.message ?? ""
  return knownBusinessRuleCodes.some((code) => rawMessage.includes(code))
    ? "validation_failed"
    : "persistence_failed"
}
