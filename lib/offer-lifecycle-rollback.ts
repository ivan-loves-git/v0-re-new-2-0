export interface OfferLifecycleSnapshot {
  status: string
  accepted_at: string | null
  expires_at: string | null
  declined_at: string | null
}

/** Restores every offer field changed by an accept/decline transition. */
export function offerLifecycleRollback(snapshot: OfferLifecycleSnapshot) {
  return {
    status: snapshot.status,
    accepted_at: snapshot.accepted_at,
    expires_at: snapshot.expires_at,
    declined_at: snapshot.declined_at,
  }
}
