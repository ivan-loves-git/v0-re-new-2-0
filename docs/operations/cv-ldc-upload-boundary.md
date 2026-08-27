# CV and LDC upload boundary

## Current contract

W-165 raises the product limit to 20 MiB through the shared private direct
upload protocol. The browser uploads to one signed path in the private `cvs`
bucket; the application server receives only small intent and finalize JSON.
The canonical current contract is
[`private-direct-upload-contract.md`](./private-direct-upload-contract.md).

All current intake, staff and repreneur CV/LDC controls use
`CV_LDC_MAX_FILE_BYTES` from `lib/upload-limits.ts`. The finalize service checks
the exact byte count, MIME type and file structure before atomically attaching
the private path to the repreneur. Portal replacement of a staff-validated LDC
remains forbidden.

## Historical W-153 route

W-153 remains historically correct: its multipart route accepted files through
4 MiB because Vercel rejects request envelopes around 4.5 MiB. That endpoint is
retained as a rollback-compatible legacy route and uses
`LEGACY_MULTIPART_MAX_FILE_BYTES`; it is no longer the current UI path and is
not evidence of the W-165 product limit.

The legacy path still consumes an anonymous one-use capability before parsing,
checks actual `File.size`, validates magic bytes and preserves ownership. It
must never be changed to claim or accept 20 MiB through a Vercel multipart
request.

## Verification

Run `pnpm verify`. The focused behavior suites are:

```sh
pnpm exec vitest run \
  lib/__tests__/upload-size-boundary.test.ts \
  lib/__tests__/w165-private-upload.test.ts \
  lib/__tests__/remaining-security-boundaries.test.ts
```

Production proof uses synthetic private documents: exact 20 MiB, one byte over
20 MiB, and one file between 4.5 and 20 MiB. No customer document is used.

## Rollback

Restore the previous application deployment to return the UI to the W-153
legacy path. Do not drop W-165 metadata, delete finalized objects or lower the
bucket limit during that rollback. Schema retirement, if ever needed, is a
separate authorized data change.
