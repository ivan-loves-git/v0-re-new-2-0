const LEGACY_OPTOUT_RECOVERY_MARKER = "wave_telemetry_legacy_optout_recovery_v1"

type PostHogOptOutRecoveryClient = {
  clear_opt_in_out_capturing(): void
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

/**
 * WAVE never offered a user analytics opt-out. Before this migration, a
 * transient transport failure called PostHog's persistent opt-out API, which
 * could leave a browser silently disabled forever. Clear only that one legacy
 * state, then retain a marker so a later, deliberate PostHog opt-out is not
 * overridden by the application.
 */
export function recoverLegacyPostHogOptOut(
  client: PostHogOptOutRecoveryClient,
  storage: StorageLike,
) {
  try {
    if (storage.getItem(LEGACY_OPTOUT_RECOVERY_MARKER) === "complete") return false
    client.clear_opt_in_out_capturing()
    storage.setItem(LEGACY_OPTOUT_RECOVERY_MARKER, "complete")
    return true
  } catch {
    // Telemetry stays optional. An unavailable browser store must not affect WAVE.
    return false
  }
}

export const __test__ = { LEGACY_OPTOUT_RECOVERY_MARKER }
