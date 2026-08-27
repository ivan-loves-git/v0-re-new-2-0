# Private direct document upload contract

## Authority and status

This is the approved W-165 contract for private document uploads up to and
including 20 MiB. It extends the historically closed W-152/W-153 4 MiB
multipart route; it does not falsify those earlier cards. The implementation
authority is migration `20260827113000_w165_private_direct_uploads.sql` and the
shared intent/upload/finalize service in `lib/private-upload-server.ts`.

Production keeps the prior effective limit until the W-165 candidate and its
migration are explicitly published.

## Protocol

1. The browser sends small JSON metadata to create an intent. The server
   authorizes the exact actor, record, document class, filename, MIME type and
   declared byte count.
2. The server records a short-lived intent and issues one signed capability for
   one random path in an existing private Supabase Storage bucket. No public
   URL or browser Storage policy is created.
3. The browser sends the file directly to that path, bypassing Vercel's
   multipart request-body boundary.
4. Finalize reloads the exact object through the service boundary, checks its
   byte count and stored MIME type, validates its file structure and computes
   SHA-256. PDFs use the isolated bounded parser.
5. One database transaction rechecks the immutable intent authority and
   atomically registers canonical metadata. Repeating finalize returns the
   same result only when the digest is unchanged.
6. Rejected, expired, abandoned, duplicate or replaced objects enter a durable
   exact-path cleanup queue before deletion is attempted. The bounded daily
   maintenance run retries unconfirmed deletions; an authenticated manual route
   can drain a larger catch-up batch without requiring another Vercel cron slot.

## Scope

The shared protocol covers generic opportunity documents, source teasers,
Information Memoranda, staff NDA artifacts, portal signed NDAs, staff and
portal CV/LDC uploads, public-intake CV/LDC uploads and external-pursuit
attachments. Avatar and image-only profile upload remain outside W-165.

Existing documents require no re-upload. Existing signed download routes,
private bucket behavior, NDA version history and Gate 1/Gate 2 access remain
unchanged.

## Limits and validation

- zero-byte files and files above `20 * 1024 * 1024` bytes are rejected;
- exactly 20 MiB is valid, subject to the document class's file-type rules;
- extension and declared MIME type must agree at intent creation;
- downloaded object size, stored MIME and structure must agree at finalize;
- signed NDA copies, source teasers and Information Memoranda remain PDF-only;
- blank NDA templates may be PDF or DOCX; CV/LDC may be PDF, DOC or DOCX;
- external-pursuit attachments retain their narrower allow-list;
- active, embedded, malformed or page-count-invalid PDFs fail closed.

The PDF parser receives untrusted bytes only in a worker with a 500-page
ceiling, a size-scaled 5-to-15-second deadline, a 160 MiB old-generation heap,
a 32 MiB young-generation heap and a 4 MiB stack. Timeout or worker failure
terminates validation; it never permits registration.

## Authorization and public intake

Staff, portal and intake actors have distinct immutable intent identities.
Portal paths require the linked repreneur and exact owned record. NDA uploads
also require an active same-namespace pursuit and current Gate 1. Cross-record,
cross-repreneur and cross-namespace attempts fail closed.

Public intake consumes its existing one-use, IP-bound capability before an
intent is created. A finalized intake object remains unclaimed and private for
at most 24 hours. The opaque handle can claim the exact CV/LDC once for the new
repreneur; abandoned and expired handles are queued for deletion.

## Rollback

The application can roll back to the prior 4 MiB multipart routes without
re-uploading existing files. The W-165 tables and finalized intent rows remain
audit metadata. A database rollback must not drop them or reduce bucket limits
while any W-165 path is referenced. If production rollback is required, first
disable new direct intents, drain pending intents and cleanup, restore the prior
application, then assess schema retirement as a separate authorized change.

## Acceptance trace

- exact 20 MiB succeeds; 20 MiB plus one byte fails before Storage;
- 4.5-to-20-MiB succeeds through the deployed direct path;
- wrong actor, wrong record, reused capability and cross-namespace access fail;
- malformed, active, mismatched and unsupported files leave no untracked
  object;
- repeated finalize is idempotent and digest-conflict-safe;
- timeout, parser failure, abandoned intent and failed cleanup remain bounded
  and recoverable through the durable queue;
- production proof uses synthetic private documents only and confirms no
  public bucket or public URL was introduced.
