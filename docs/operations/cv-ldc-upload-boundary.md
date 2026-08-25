# CV and LDC upload boundary

## Contract

W-153's approved M2 scope sets a 4 MB maximum file size for every CV and
Lettre de cadrage upload surface. These multipart requests transit a Vercel
Function, whose documented request-payload ceiling is 4.5 MB. The application
therefore leaves bounded multipart overhead without introducing a custom
streaming parser. Larger-upload architecture is deferred until there is real
demand.

Reference: [Vercel Functions request body limit](https://vercel.com/docs/functions/limitations#request-body-size).

The shared code authority is `lib/upload-limits.ts`. The API, intake clients,
staff clients, repreneur client, upload metadata and visible copy must all use
or reflect that contract.

## Security invariants

- Vercel rejects a request envelope above 4.5 MB before the application parses
  multipart data.
- The API rejects a parsed file above 4 MB before creating a Storage client,
  writing an object or updating a repreneur record.
- `Content-Length` is only an early rejection optimisation. A false small value
  cannot bypass the authoritative 4 MB `File.size` check.
- An anonymous intake upload consumes its one-use, IP-bound capability before
  multipart parsing. Lowering the file ceiling does not weaken replay control.
- There is no schema, bucket-policy or production-data change in this rollout.

## Verification

Run:

```sh
pnpm exec vitest run \
  lib/__tests__/upload-size-boundary.test.ts \
  lib/__tests__/remaining-security-boundaries.test.ts
```

The synthetic suite proves exact-4-MB acceptance, one-byte-over rejection,
false-small-`Content-Length` rejection before persistence, early 4.5-MB
envelope rejection, capability ordering and complete client-surface alignment.

## Production check

After the exact candidate is deployed, execute one bounded, synthetic request
slightly above 4.5 MB without a valid upload capability and retain only response
status/headers. It must return Vercel's `413 FUNCTION_PAYLOAD_TOO_LARGE`; it must
not reach application telemetry, Storage or a database record. Do not execute a
denial-of-service sequence or upload customer material. Then perform one normal
synthetic upload through an approved application path and clean up its
disposable object through that path's normal control.

The oversized production boundary check is deliberately not part of local
verification.

## Rollback

Rollback is application-only: restore the prior Vercel deployment or revert the
W-153 candidate commit, then verify `/api/upload-cv` health. No database,
Storage-policy or data rollback is required. If the 4 MB product limit proves
insufficient, do not raise it above the platform envelope; reopen the deferred
direct-to-Storage architecture decision instead.
