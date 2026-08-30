# Governance projection v1

`re-new-team/renew-governance` is the authority. WAVE stores only the immutable, allowlisted snapshot created by `pnpm governance:refresh`; neither the browser nor ordinary WAVE/AI reads require a GitHub token.

Run the command without flags first. It pins `main` to an exact commit, validates the full accepted registry plus bounded issue facts, and prints a revision/digest confirmation. To write, run the exact printed confirmation with `--apply`. Invalid GitHub data, GitHub outage, failed validation, or an optimistic-current conflict writes nothing and leaves the previously selected snapshot intact. A repeated identical apply is a no-op.

The snapshot deliberately excludes GitHub issue bodies, comments, attachments, and all other prose. Future staff UI and WAVE AI call `readCurrentGovernanceProjection()` and receive either the same current snapshot revision or an explicit unavailable state; there is no PDR fallback.

Historic closed Done child records may be excluded only when they have no native Issue Type (`legacy_missing_issue_type`) or are a native Ticket/Bug directly parented by a closed non-Product-Change record (`legacy_non_product_change_parent`). Each exclusion must exactly reproduce its source title and URL, carry no governance marker fields, and cannot be a dependency of an active item. Every other unknown type fails the refresh; these generic exceptions never guess a type or placement.

Persisted data is limited to the accepted registry, bounded issue facts (number, title, type/state/status, timestamps, assignees, parent/dependency numbers, allowed Re-New platform pull-request references, and approved placement), plus the safe exclusion record. Issue bodies, discussion, attachments and other prose are never stored.

The repository tests exercise the projection contract and assert the migration's required security primitives, but they do not execute the SQL against PostgreSQL. Applying the migration to the production database remains its own explicitly authorised gate and must include a disposable or provider-backed SQL verification before any live snapshot is written.
