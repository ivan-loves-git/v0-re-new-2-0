import "server-only"

/** Emergency roll-forward switch: preserve access denials and evidence while
 * pausing new recipient-specific work and private deletion dispatch. */
export const RECIPIENT_IM_PAUSED_MESSAGE = "Recipient-specific IM operations are temporarily paused."

export function recipientImOperationsPaused() {
  return process.env.RECIPIENT_IM_OPERATIONS_DISABLED === "1"
}
