# Vercel deployment storage

Function Storage stores deployed server bundles, including their regional
copies. Deployment Storage stores build output. These are separate from
uploaded business documents in Supabase and from request traffic.

## Avoid redundant builds

`vercel.json` runs `scripts/vercel-ignore-build.mjs` before dependencies are
installed. It skips a build only when all changes since the last successful
deployment for the same branch are allowlisted repository Markdown documents
or agent instructions. Commit messages are never used to decide.

Application code, public files, dependencies, scripts, configuration, unknown
paths, mixed changes and missing Git history always build. A new branch with
no prior successful deployment also builds. Same-commit redeployments build
because environment configuration may have changed. Set `RENEW_FORCE_BUILD=1`
or uncheck **Use project's Ignore Build Step** when deliberately rebuilding.

Repository documentation is not a runtime input. If application code begins
loading it, remove the corresponding path from the script's allowlist in the
same change. Tests use temporary synthetic repositories, not live deployments.

Skipped builds do not produce new application bundles, but Vercel still counts
them toward build/deployment limits. This filter cannot reclaim old storage or
remove usage already accrued. It leaves retention, aliases and recovery intact.
Vercel records an intentional skip as `CANCELED`; the previous successful
deployment remains available. Check the build log's `Skip:` reason before
treating that status as an application failure.

## Measure before cleanup

Compare the Usage dashboard's project breakdown with active deployments and
the Recently Deleted list. Do not equate a deployment-count reduction with a
measured storage reduction. Successful deletions remain recoverable for 30 days;
Vercel documents permanent resource removal after that recovery window. Billing
uses daily project maxima aggregated as GB-months. Record the observation date
and distinguish live bundle bytes, historical usage and recovery copies.

References: [storage accounting](https://vercel.com/docs/deployment-storage),
[retention and recovery](https://vercel.com/docs/deployment-retention),
[ignored builds](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step),
[previous successful Git SHA](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_git_previous_sha).
