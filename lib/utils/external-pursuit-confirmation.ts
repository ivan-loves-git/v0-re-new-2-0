export interface ExternalPursuitConfirmationAttempt {
  readonly pursuitId: string
  readonly idempotencyKey: string
}

export interface ExternalPursuitConfirmationRetryState {
  readonly pending: ExternalPursuitConfirmationAttempt | null
  readonly inFlight: boolean
}

export const EMPTY_EXTERNAL_PURSUIT_CONFIRMATION_STATE: ExternalPursuitConfirmationRetryState =
  Object.freeze({ pending: null, inFlight: false })

export function beginExternalPursuitConfirmation(
  state: ExternalPursuitConfirmationRetryState,
  pursuitId: string,
  createKey: () => string,
):
  | { started: true; state: ExternalPursuitConfirmationRetryState; attempt: ExternalPursuitConfirmationAttempt }
  | { started: false; state: ExternalPursuitConfirmationRetryState } {
  if (state.inFlight || (state.pending && state.pending.pursuitId !== pursuitId)) {
    return { started: false, state }
  }

  const attempt = state.pending ?? Object.freeze({ pursuitId, idempotencyKey: createKey() })
  return {
    started: true,
    attempt,
    state: Object.freeze({ pending: attempt, inFlight: true }),
  }
}

export function settleExternalPursuitConfirmation(
  state: ExternalPursuitConfirmationRetryState,
  outcome: "confirmed" | "rejected" | "ambiguous",
): ExternalPursuitConfirmationRetryState {
  return Object.freeze({
    pending: outcome === "ambiguous" ? state.pending : null,
    inFlight: false,
  })
}
