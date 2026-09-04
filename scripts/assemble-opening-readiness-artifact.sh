#!/usr/bin/env bash
set -euo pipefail

# The runner may retain diagnostic material while it executes, but published
# artifacts have a smaller contract: one aggregate JSON file with a fixed
# allowlist of outcome counts and booleans. This script is intentionally the
# only boundary between working evidence and the retained GitHub artifact.
working_dir="${OPENING_READINESS_EVIDENCE_DIR:-${RUNNER_TEMP:?RUNNER_TEMP is required}/opening-readiness-evidence}"
published_dir="${OPENING_READINESS_PUBLISHED_DIR:-${RUNNER_TEMP:?RUNNER_TEMP is required}/opening-readiness-published}"
: "${OPENING_FIXTURE_RELEASE_SHA:?OPENING_FIXTURE_RELEASE_SHA is required}"
mkdir -p "$published_dir"

access_summary='null'
if [[ -f "$working_dir/portal-access-uat.json" ]]; then
  access_summary=$(jq -c '{
    enabled: {
      cancelNoOp: .freshEnable.cancelNoOp,
      confirmedDeliveries: .freshEnable.confirmedDeliveries,
      roleCreated: .freshEnable.oneNewRole,
      sessionsAtCompletion: .freshEnable.activeSessions
    },
    resent: {
      cancelNoOp: .resend.cancelNoOp,
      confirmedDeliveries: .resend.confirmedDeliveries,
      sessionsRetained: .resend.activeSessionsRetained,
      observedUnusedRecordsAfterOneResend: .resend.observedUnusedResetRecordsAfterOneResend
    },
    staleConfirmation: .staleConfirmation,
    disabled: {
      cancelNoOp: .disable.cancelNoOp,
      roleRemoved: .disable.roleRemoved,
      sessionsRevoked: .disable.activeSessionsRevoked,
      unusedLinksRevoked: .disable.unusedResetLinksRevoked
    },
    repaired: {
      cancelNoOp: .repair.cancelNoOp,
      confirmedDeliveries: .repair.confirmedDeliveries,
      oneRole: .repair.oneRole,
      priorSessionsRevoked: .repair.priorSessionsRevoked
    },
    recovery: {
      validLinkConsumedOnce: .setup.validLinkConsumedOnce,
      replayRejected: .setup.replayRejected,
      consumedBrowserRecovery: .setup.consumedBrowserRecovery,
      expiredRejected: .recovery.expiredRejected,
      malformedRejected: .recovery.malformedRejected,
      missingRejected: .recovery.missingRejected,
      navigationSafe: .recovery.missingRefreshAndBackForwardSafe,
      revokedRejected: .recovery.disableRevokedRejected
    },
    staffBoundary: .nonStaff
  }' "$working_dir/portal-access-uat.json")
fi

teardown_summary='null'
if [[ -f "$working_dir/teardown.json" ]]; then
  teardown_summary=$(jq -c '{
    cleanupBoundary,
    stackDestroySucceeded,
    residue: {containers, volumes, networks}
  }' "$working_dir/teardown.json")
fi

jq -n \
  --arg releaseSha "$OPENING_FIXTURE_RELEASE_SHA" \
  --argjson access "$access_summary" \
  --argjson teardown "$teardown_summary" \
  '{releaseSha: $releaseSha, artifactPolicy: "aggregate-safe allowlist only", accessUat: $access, teardown: $teardown}' \
  > "$published_dir/aggregate-summary.json"
