# Permanent private QA schema contract — release build 771

## Purpose

This directory provides the deterministic, sanitized structure contract for Re-New's one persistent, isolated Supabase QA branch. It does not replace the production migration ledger and must never be applied to production or to a branch containing application, Auth or Storage object data.

## Authority and provenance

- `771_public_schema.sql` is a `pg_dump 17.10 --schema-only --schema=public` export of the released build-771 production structure.
- The export excluded rows, large objects, owners, comments, publications, subscriptions, security labels and tablespaces.
- The temporary production connection file lived outside the repository with mode `0600`, was injected directly into `pg_dump`, and was deleted immediately after export.
- The raw export contained five email literals and customer-name fragments embedded in provisional-source integrity functions and identifiers. They were replaced in place with deterministic `TEST-schema-redacted-*` / `qa_person` labels before the artifact was accepted. No raw copy remains; the identifier replacement is deliberately short enough to avoid PostgreSQL's 63-byte identifier truncation.
- `771_public_schema.sha256` fingerprints the sanctioned, sanitized artifact.
- `771_extensions.sql` records the released extension dependencies needed by the public schema.
- `771_preview_cleanup.sql` removes only the known partial sequence left by the pre-baseline Git migration attempt, then rejects every other public-schema object inside the same reconstruction transaction.
- `771_test_storage.sql` creates only two empty private buckets from fixed repository-owned setup; it copies no bucket or object data.
- `qa_control.sql` owns the QA-only lease, heartbeat, server-side manifest, recovery ownership and schema-blocked state. It is not part of the production public schema.
- `permanent_qa_rebuild.sql` is the mismatch-only, advisory-locked rebuild guard. It runs only after the synchronizer independently proves the exact non-production branch is empty and has no active lease.
- `../qa-contract.json` checksums every synchronization input and records the expected live catalog fingerprint.
- Supabase-managed `supabase_admin` default privileges are supplied by each branch and are intentionally not replayed by the application baseline; application-owned `postgres` defaults and all explicit object grants remain preserved.

## Why this is separate from `supabase/migrations`

The repository has eight active Supabase migration files and roughly 110 historical numbered release scripts. Production's recorded migration ledger starts after the original `repreneurs` foundation was created, so neither source can reconstruct a fresh database by itself.

The existing migration files remain production history and must not be replayed after this build-771 baseline. One-time provisioning applies the sanctioned baseline to the persistent data-less branch. Ordinary candidates run `qa:schema:sync`: a matching fingerprint performs no DDL; a mismatch is reconciled only while the branch is empty, inside one transaction, and is re-fingerprinted before fixtures are permitted. A failed or ambiguous synchronization marks the branch blocked.

Future application schema changes must be captured as ordinary additive migrations after build 771. When the sanctioned baseline changes, create a new versioned artifact and fingerprint rather than editing this one silently.

## Commands

Verify the artifact before use:

```bash
pnpm qa:schema:verify
```

Synchronize the persistent QA branch:

```bash
QA_SUPABASE_PROJECT_REF=<preview-ref> \
DATABASE_URL=<preview-database-url> \
QA_DATABASE_CA_CERT_FILE=<verified-ca-file> \
pnpm qa:schema:sync
```

Secrets must come from an untracked local file or encrypted provider store. Do not place them in shell history, tracked files, command arguments or reports.

The permanent synchronizer:

1. rejects production ref `iiuqcdnmxhtyispnykgf`;
2. requires provider readback proving the exact authorised parent, data-less, non-default, persistent and healthy branch;
3. proves the database URL identifies the same preview ref and uses verified TLS;
4. performs no DDL when the live fingerprint matches;
5. before mismatch reconciliation, refuses any application, Better Auth, Supabase Auth or Storage object row and any active QA lease;
6. applies the deterministic public structure and empty private buckets in one transaction, then requires the exact candidate fingerprint;
7. uses `ON_ERROR_STOP=1`, verified TLS and process-only database credentials.

## Verification boundary

After reconstruction, branch-only verification must prove:

- the branch ref differs from production;
- the public schema fingerprint matches the sanctioned structure;
- Better Auth tables and indexes exist;
- P1–P3 tables, functions, views, grants and RLS exist;
- `cvs` and `opportunity-documents` are private and empty;
- Supabase Auth has zero users and Storage has zero objects before fixtures;
- exact-ID synthetic fixtures are removed with zero residue.

This is infrastructure for later QA. It does not implement or execute P1–P3.
