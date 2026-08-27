# NDA PDF evidence validation

## Current decision

W-152 established deterministic PDF validation without claiming antivirus
coverage. W-165 preserves that decision and makes the validator safe for valid
PDFs up to and including 20 MiB through the private direct-upload protocol.
No malware-scanning or quarantine vendor is selected in this release.

The canonical upload contract is
[`private-direct-upload-contract.md`](./private-direct-upload-contract.md).

## Accepted path

1. The intent service checks the exact actor, pursuit or opportunity, role,
   filename, PDF MIME and declared size before issuing an exact private path.
2. The browser uploads directly to private Storage. The object is untrusted and
   has no canonical document row at this stage.
3. Finalize downloads the exact object, proves its declared byte count and MIME
   type, then computes SHA-256.
4. The server rejects a missing PDF header, non-whitespace polyglot trailer,
   active-action names, embedded payload, JavaScript, attachments or open
   actions.
5. PDF.js parses one to 500 pages in a dedicated Node worker with `eval`
   disabled. The parent applies a size-scaled 5-to-15-second deadline and
   terminates the worker on timeout. V8 limits are 160 MiB old generation,
   32 MiB young generation and a 4 MiB stack.
6. Only a successful validation may atomically register the canonical NDA
   evidence. Failure first records durable exact-path cleanup and then attempts
   private-object deletion.

The parser never renders or executes the document. Application logs contain no
document bytes, filename, private path, signed capability or parser exception
with customer content.

## Historical W-152 route

The W-152 4 MiB multipart action remains rollback-compatible and historically
closed. It is not the current 20 MiB path. Its role, Gate and evidence rules are
unchanged and it continues to fail closed.

## Verification and rollback

Run `pnpm verify`; the focused parser/action suites are:

```sh
pnpm exec vitest run \
  lib/__tests__/pdf-evidence.test.ts \
  lib/__tests__/pdf-evidence-isolation.test.ts \
  lib/__tests__/pdf-evidence-actions.test.ts \
  lib/__tests__/w165-private-upload.test.ts
```

Production verification uses synthetic inert PDFs only. A parser failure never
authorizes bypass. Application rollback restores the previous deployment;
finalized W-165 metadata and private files remain valid and must not be removed
as part of that rollback.
