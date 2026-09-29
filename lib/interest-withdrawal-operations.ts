import "server-only"

/** Emergency roll-forward pause. Never revive historical tokens or access. */
export function interestWithdrawalOperationsPaused() {
  return process.env.INTEREST_WITHDRAWAL_DISABLED === "1"
}
