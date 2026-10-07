/** Emergency write stop; retained history and unrelated lifecycle actions stay readable. */
export function areReasonedLifecycleWritesEnabled() {
  return process.env.REASONED_LIFECYCLE_WRITES_ENABLED !== "false"
}

export const REASONED_LIFECYCLE_WRITE_HOLD_MESSAGE = "Reasoned Drop, Pause and Stale closure are temporarily unavailable. Retained history is still available."
