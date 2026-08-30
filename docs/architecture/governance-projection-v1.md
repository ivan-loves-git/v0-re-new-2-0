# Governance projection v1

`re-new-team/renew-governance` is the authority. WAVE stores only the immutable, allowlisted snapshot created by `pnpm governance:refresh`; neither the browser nor ordinary WAVE/AI reads require a GitHub token.

Run the command without flags first. It pins `main` to an exact commit, validates the full accepted registry plus bounded issue facts, and prints a revision/digest confirmation. To write, run the exact printed confirmation with `--apply`. Invalid GitHub data, GitHub outage, failed validation, or an optimistic-current conflict writes nothing and leaves the previously selected snapshot intact. A repeated identical apply is a no-op.

The snapshot deliberately excludes GitHub issue bodies, comments, attachments, and all other prose. Future staff UI and WAVE AI call `readCurrentGovernanceProjection()` and receive either the same current snapshot revision or an explicit unavailable state; there is no PDR fallback.

Two historic closed Done child records without a native Issue Type may be listed as `legacy_missing_issue_type` exclusions. Every other unknown type fails the refresh; the exception never guesses a Ticket or Bug.
