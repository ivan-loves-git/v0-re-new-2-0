export const BOOTSTRAP_RELEASE_BUILD_NUMBER = 766

function readBuildNumber(releaseBuildSource, context) {
  const matched = releaseBuildSource.match(/RELEASE_BUILD_NUMBER = "(\d+)"/)
  if (!matched) {
    throw new Error(`${context} must export a numeric RELEASE_BUILD_NUMBER.`)
  }

  return Number(matched[1])
}

/**
 * Validates the committed release sequence without relying on a network API.
 * `runGit` is injected so the shallow-checkout contract is testable directly.
 */
export function checkReleaseBuildNumber({ releaseBuildSource, runGit }) {
  const buildNumber = readBuildNumber(releaseBuildSource, "lib/release-build.mjs")
  const isShallow = runGit(["rev-parse", "--is-shallow-repository"]).trim() === "true"

  if (!isShallow) {
    const commitCount = Number(runGit(["rev-list", "--count", "HEAD"]).trim())
    if (buildNumber < commitCount || buildNumber > commitCount + 1) {
      throw new Error(
        `Release build mismatch: source is ${buildNumber}, but HEAD is ${commitCount}. ` +
          "The source must match HEAD or be exactly one prepared production commit ahead.",
      )
    }

    return buildNumber === commitCount
      ? `Release build ${buildNumber} matches HEAD.`
      : `Release build ${buildNumber} is prepared for the next production commit.`
  }

  let parentSource
  try {
    parentSource = runGit(["show", "HEAD^:lib/release-build.mjs"])
  } catch {
    if (buildNumber !== BOOTSTRAP_RELEASE_BUILD_NUMBER) {
      throw new Error(
        `Shallow checkout cannot read the parent release source. Only bootstrap build ${BOOTSTRAP_RELEASE_BUILD_NUMBER} is allowed without it.`,
      )
    }

    return `Release build ${buildNumber} is the approved bootstrap without a parent release source.`
  }

  const parentBuildNumber = readBuildNumber(parentSource, "parent lib/release-build.mjs")
  if (buildNumber <= parentBuildNumber) {
    throw new Error(
      `Release build ${buildNumber} must be greater than its parent ${parentBuildNumber} in a shallow production checkout.`,
    )
  }

  return `Release build ${buildNumber} advances shallow-checkout parent ${parentBuildNumber}.`
}
