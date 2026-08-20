import { BOOTSTRAP_RELEASE_BUILD_NUMBER } from "./release-build-check.mjs"

export const BOOTSTRAP_RELEASE_COMMIT_COUNT = 765

function releaseBuildSource(buildNumber) {
  return `export const RELEASE_BUILD_NUMBER = "${buildNumber}"\n`
}

function readBuildNumber(releaseBuildSource) {
  const matched = releaseBuildSource.match(/RELEASE_BUILD_NUMBER = "(\d+)"/)
  if (!matched) {
    throw new Error("lib/release-build.mjs must export a numeric RELEASE_BUILD_NUMBER; refusing to overwrite it.")
  }

  return Number(matched[1])
}

/**
 * Prepares exactly one production release number from a complete local history.
 * The only missing-file exception is the declared 766 bootstrap from release 765.
 */
export function prepareReleaseBuildNumber({ releaseBuildSource: existingSource, currentCommitCount }) {
  if (existingSource === undefined) {
    if (currentCommitCount !== BOOTSTRAP_RELEASE_COMMIT_COUNT) {
      throw new Error(
        `Missing lib/release-build.mjs bootstrap is only supported at full-history commit count ${BOOTSTRAP_RELEASE_COMMIT_COUNT}.`,
      )
    }

    return {
      buildNumber: BOOTSTRAP_RELEASE_BUILD_NUMBER,
      source: releaseBuildSource(BOOTSTRAP_RELEASE_BUILD_NUMBER),
    }
  }

  const currentBuildNumber = readBuildNumber(existingSource)
  if (currentBuildNumber !== currentCommitCount) {
    throw new Error(
      `Cannot bump release build number: source is ${currentBuildNumber}, but HEAD is ${currentCommitCount}. ` +
        "First reconcile the committed release number with HEAD.",
    )
  }

  const nextBuildNumber = currentCommitCount + 1
  return {
    buildNumber: nextBuildNumber,
    source: existingSource.replace(`RELEASE_BUILD_NUMBER = "${currentBuildNumber}"`, `RELEASE_BUILD_NUMBER = "${nextBuildNumber}"`),
  }
}
