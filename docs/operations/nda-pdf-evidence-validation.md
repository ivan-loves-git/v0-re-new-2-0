# NDA PDF evidence validation

## M2 decision

W-152 accepts a PDF as canonical NDA evidence only after server-side signature,
envelope and structural validation. The maintained parser is Mozilla PDF.js,
pinned exactly in `package.json` and configured without `eval` support.

No malware-scanning or quarantine vendor is selected, purchased or introduced
in M2. The canonical PDR decision defers that vendor/cost choice to M3. The M2
control is therefore deterministic PDF validation on both already-approved
upload paths, not a claim of antivirus coverage.

## Accepted path

1. Existing role, pursuit ownership, Gate 1 and 4 MB checks run first.
2. The browser MIME and extension must match the approved role.
3. The server reads the already-bounded file and rejects a missing PDF header,
   non-whitespace polyglot trailer, active-action names or embedded payload.
4. PDF.js must parse a non-empty document with no more than 500 pages in a
   dedicated Node worker. The parent enforces the shared three-second wall-clock
   deadline by terminating that worker; V8 heap, young-generation and stack
   limits bound the parser process independently of the request.
5. Document/page JavaScript, attachments and open actions are rejected.
6. Only then may Storage upload and canonical evidence registration run.

The parser never renders or executes the document and application code does not
log document bytes, resettable URLs or parser exceptions containing content.

## Evidence

Run with synthetic documents only:

```sh
pnpm exec vitest run \
  lib/__tests__/pdf-evidence.test.ts \
  lib/__tests__/pdf-evidence-isolation.test.ts \
  lib/__tests__/pdf-evidence-actions.test.ts \
  lib/__tests__/critical-operation-actions.test.ts
```

The action tests prove valid staff and portal PDFs reach Storage plus canonical
registration. Wrong-signature, malformed, active, embedded and polyglot inputs
are rejected; action-level negatives prove that rejection leaves no Storage
object and no evidence record.

## Gate 2 and rollback

After deployment, UAT must upload and download one synthetic inert PDF through
each approved path, then remove the disposable evidence through the normal
controlled cleanup path. No malicious fixture is sent to production.

Rollback is application-only: restore the prior Vercel deployment or revert the
W-152 commit. No schema or bucket-policy rollback is involved. A parser failure
must fail closed; do not bypass validation to restore uploads. If normal PDFs
show a compatibility issue, hold the upload and adjust the parser contract in a
new reviewed candidate.
