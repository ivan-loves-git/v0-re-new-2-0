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
# A prior attempt must never leave a publishable file behind after a later
# validation failure.
rm -f "$published_dir/aggregate-summary.json"

access_summary='null'
if [[ -f "$working_dir/portal-access-uat.json" ]]; then
  access_summary=$(jq -ce '
    def flag:
      if type == "boolean" then . else error("expected aggregate boolean") end;
    def count:
      if type == "number" and floor == . and . >= 0 and . <= 1000000
      then . else error("expected bounded aggregate count") end;
    {
    enabled: {
      cancelNoOp: (.freshEnable.cancelNoOp | flag),
      confirmedDeliveries: (.freshEnable.confirmedDeliveries | count),
      roleCreated: (.freshEnable.oneNewRole | flag),
      sessionsAtCompletion: (.freshEnable.activeSessions | count)
    },
    resent: {
      cancelNoOp: (.resend.cancelNoOp | flag),
      confirmedDeliveries: (.resend.confirmedDeliveries | count),
      sessionsRetained: (.resend.activeSessionsRetained | flag),
      observedUnusedRecordsAfterOneResend: (.resend.observedUnusedResetRecordsAfterOneResend | count)
    },
    staleConfirmation: {
      rejected: (.staleConfirmation.rejected | flag),
      extraDeliveries: (.staleConfirmation.extraDeliveries | count)
    },
    disabled: {
      cancelNoOp: (.disable.cancelNoOp | flag),
      roleRemoved: (.disable.roleRemoved | flag),
      sessionsRevoked: (.disable.activeSessionsRevoked | flag),
      unusedLinksRevoked: (.disable.unusedResetLinksRevoked | flag)
    },
    repaired: {
      cancelNoOp: (.repair.cancelNoOp | flag),
      confirmedDeliveries: (.repair.confirmedDeliveries | count),
      oneRole: (.repair.oneRole | flag),
      priorSessionsRevoked: (.repair.priorSessionsRevoked | flag)
    },
    recovery: {
      validLinkConsumedOnce: (.setup.validLinkConsumedOnce | flag),
      replayRejected: (.setup.replayRejected | flag),
      consumedBrowserRecovery: (.setup.consumedBrowserRecovery | flag),
      expiredRejected: (.recovery.expiredRejected | flag),
      malformedRejected: (.recovery.malformedRejected | flag),
      missingRejected: (.recovery.missingRejected | flag),
      navigationSafe: (.recovery.missingRefreshAndBackForwardSafe | flag),
      revokedRejected: (.recovery.disableRevokedRejected | flag)
    },
    staffBoundary: {
      staffRouteDenied: (.nonStaff.staffRouteDenied | flag),
      staffActionUiAbsent: (.nonStaff.staffActionUiAbsent | flag)
    }
  }' "$working_dir/portal-access-uat.json")
fi

handoff_summary='null'
if [[ -f "$working_dir/pursuit-handoffs.json" ]]; then
  handoff_summary=$(jq -ce '
    def flag: if type == "boolean" then . else error("expected aggregate boolean") end;
    {e4: {exactValidation: (.e4.exactValidation|flag), frozenBlankNdaRequest: (.e4.frozenBlankNdaRequest|flag)},
     e6: {persistedNotice: (.e6.persistedNotice|flag), portalDeniedBeforeNotice: (.e6.portalDeniedBeforeNotice|flag), mobileAction: (.e6.mobileAction|flag)},
     e7: {canonicalInteraction: (.e7.canonicalInteraction|flag), exactAttachments: (if .e7.exactAttachments == 2 then 2 else error("expected two signed copies") end)},
     e8: {memoApproval: (.e8.memoApproval|flag), completed: (.e8.completed|flag)}}' "$working_dir/pursuit-handoffs.json")
fi

teardown_summary='null'
if [[ -f "$working_dir/teardown.json" ]]; then
  teardown_summary=$(jq -ce '
    def flag:
      if type == "boolean" then . else error("expected aggregate boolean") end;
    def count:
      if type == "number" and floor == . and . >= 0 and . <= 1000000
      then . else error("expected bounded aggregate count") end;
    {
      cleanupBoundary: (
        if .cleanupBoundary == "whole disposable stack"
        then .cleanupBoundary else error("unexpected cleanup boundary") end
      ),
      stackDestroySucceeded: (.stackDestroySucceeded | flag),
      residue: {
        containers: (.residue.containers | count),
        volumes: (.residue.volumes | count),
        networks: (.residue.networks | count)
      }
    }' "$working_dir/teardown.json")
fi

jq -n \
  --arg releaseSha "$OPENING_FIXTURE_RELEASE_SHA" \
  --argjson access "$access_summary" \
  --argjson teardown "$teardown_summary" \
  --argjson handoffs "$handoff_summary" \
  '{releaseSha: $releaseSha, artifactPolicy: "aggregate-safe allowlist only", accessUat: $access, pursuitHandoffs: $handoffs, teardown: $teardown}' \
  > "$published_dir/aggregate-summary.json"
