# Domain Pitfalls: CRM Launch Readiness

**Domain:** Next.js + Supabase CRM with file uploads, data persistence, and user relaunch
**Researched:** 2026-01-26
**Confidence:** HIGH (verified against official docs and GitHub issues)

---

## Critical Pitfalls

Mistakes that cause data loss, broken features, or major user impact.

---

### Pitfall 1: File Upload Results in 15-Byte Garbage Files

**What goes wrong:** Files uploaded via Next.js server actions to Supabase Storage appear to succeed but result in unreadable 15-byte files instead of the actual content. The upload returns no error, the file exists in storage, but opening it shows corrupted/empty data.

**Why it happens:** Passing a `File` object directly from `FormData` to `supabase.storage.upload()` on the server side. The File object's `arrayBuffer()` method must be called explicitly and converted to a Buffer. Without this conversion, only the File object's metadata (about 15 bytes) gets uploaded.

**Consequences:**
- Users upload CVs/documents that appear successful
- Admin opens file later and finds it corrupted/unreadable
- No error in logs to diagnose the issue
- User trust destroyed

**Detection (warning signs):**
- File sizes in Supabase Storage dashboard show ~15 bytes for all uploads
- Console.log of `file.size` on server shows correct size, but storage shows different
- Files download but won't open

**Prevention:**
```typescript
// WRONG - uploads metadata only
const { error } = await supabase.storage.from("cvs").upload(path, file)

// CORRECT - converts to Buffer first
const arrayBuffer = await file.arrayBuffer()
const buffer = Buffer.from(arrayBuffer)
const { error } = await supabase.storage.from("cvs").upload(path, buffer, {
  contentType: file.type
})
```

**Which phase should address:** File Upload Bug Fix phase (immediate priority)

**Sources:**
- [GitHub Issue #86 - Upload File Storage Next.js](https://github.com/supabase/storage/issues/86)
- [Supabase Storage File Upload Guide](https://nikofischer.com/supabase-storage-file-upload-guide)

---

### Pitfall 2: Server Actions Silent 1MB Body Limit

**What goes wrong:** File uploads larger than 1MB fail silently with no error reaching your catch block. The server action appears to hang or return undefined, with no indication of what went wrong.

**Why it happens:** Next.js server actions have a default body size limit of 1MB. When exceeded, the request fails before your action code executes, so your error handling never runs.

**Consequences:**
- Users with 2-5MB PDFs see "something went wrong" with no clear error
- Debugging is impossible without knowing about this limit
- Production uploads fail mysteriously

**Detection (warning signs):**
- Uploads work in development but fail in production (Vercel)
- Small files work, files over ~1MB fail
- Server action appears to hang with no response
- No errors in your application logs

**Prevention:**

1. Configure `next.config.mjs`:
```javascript
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // Match your max file size
    },
  },
}
```

2. For files larger than 10MB, use signed URLs for direct client-to-Supabase upload:
```typescript
// Server: Generate signed URL
const { data } = await supabase.storage.from("cvs").createSignedUploadUrl(path)

// Client: Upload directly to Supabase (bypasses Next.js entirely)
await fetch(data.signedUrl, { method: "PUT", body: file })
```

**Which phase should address:** File Upload Bug Fix phase

**Sources:**
- [Next.js Server Actions Body Size Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [GitHub Discussion #49891](https://github.com/vercel/next.js/discussions/49891)

---

### Pitfall 3: RLS Policies Silently Block Updates (No Error)

**What goes wrong:** Supabase `.update()` returns `error: null` and appears to succeed, but the data doesn't actually change in the database. The UI shows the new value momentarily, then reverts on page refresh.

**Why it happens:** Row Level Security (RLS) policies that fail return HTTP 200 with empty results instead of an error. PostgreSQL's RLS is designed to silently filter rows rather than throw errors for security reasons.

**Consequences:**
- Admin scoring edits appear to save but don't persist
- Extremely difficult to debug (no errors anywhere)
- Data integrity issues when users think saves worked
- Hours of debugging looking in the wrong places

**Detection (warning signs):**
- Updates return `{ error: null, data: [] }` (empty data array)
- Changes visible in UI but gone after refresh
- Same update works in Supabase Dashboard but not from app
- `supabase.auth.getUser()` returns null unexpectedly

**Prevention:**

1. Always use `.select()` after mutations to verify the update happened:
```typescript
// WRONG - silent failure
const { error } = await supabase.from("repreneurs").update({ tier2_stars: 5 }).eq("id", id)

// CORRECT - returns data if successful, empty array if RLS blocked
const { data, error } = await supabase
  .from("repreneurs")
  .update({ tier2_stars: 5 })
  .eq("id", id)
  .select()
  .single()

if (!data) {
  throw new Error("Update blocked by RLS policy")
}
```

2. For admin operations, use `createAdminClient()` which bypasses RLS:
```typescript
// Server-side admin operations should use service role
const adminClient = createAdminClient()
const { error } = await adminClient.from("repreneurs").update(...)
```

3. Check your RLS policies allow the operation:
```sql
-- Common missing policy: UPDATE requires both USING and WITH CHECK
CREATE POLICY "Users can update own records"
ON repreneurs
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);
```

**Which phase should address:** Data Persistence Bug Fix phase

**Sources:**
- [GitHub Discussion #9214 - RLS Should Log Rejections](https://github.com/orgs/supabase/discussions/9214)
- [Supabase RLS Troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8)

---

### Pitfall 4: React State Shows Stale Data After Supabase Mutation

**What goes wrong:** User edits a field, sees the new value, navigates away, comes back, and sees the old value. Or worse: edits don't persist and silently revert.

**Why it happens:** Multiple causes:
1. Using optimistic UI without proper error rollback
2. Not awaiting the mutation before updating local state
3. Next.js caching serving stale data after mutation
4. `revalidatePath()` not actually clearing the cache

**Consequences:**
- User frustration ("I just saved this!")
- Data inconsistency between what user sees and database reality
- Support tickets for "broken" features that "worked yesterday"

**Detection (warning signs):**
- Edits work once but subsequent edits show old values
- Changes visible immediately but wrong after page refresh
- Different users see different data for same record
- `revalidatePath()` calls have no effect

**Prevention:**

1. Always await mutations and check for errors before updating UI:
```typescript
// In server action
try {
  const { error } = await supabase.from("repreneurs").update(data).eq("id", id)
  if (error) throw error

  revalidatePath(`/repreneurs/${id}`)
  return { success: true }
} catch (e) {
  return { success: false, error: e.message }
}

// In client
const result = await updateRepreneur(id, data)
if (!result.success) {
  // Rollback optimistic update
  toast.error("Save failed: " + result.error)
}
```

2. Ensure proper Next.js cache invalidation:
```typescript
// After mutation, revalidate ALL relevant paths
revalidatePath("/repreneurs")
revalidatePath(`/repreneurs/${id}`)
revalidatePath("/pipeline")
revalidatePath("/dashboard")
```

3. For real-time requirements, use Supabase Realtime:
```typescript
// Subscribe to changes for instant updates
supabase.channel('repreneurs').on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'repreneurs'
}, handleUpdate)
```

**Which phase should address:** Data Persistence Bug Fix phase

**Sources:**
- [GitHub Discussion #37327 - UPDATE operations not persisting](https://github.com/orgs/supabase/discussions/37327)
- [Supabase React Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs)

---

## Moderate Pitfalls

Mistakes that cause delays, user confusion, or require rework.

---

### Pitfall 5: Database Cleanup Breaks Migration History

**What goes wrong:** After manually cleaning production data (DELETE, TRUNCATE), subsequent `supabase db pull` or migrations fail with "migration history mismatch" errors. The CLI refuses to work with the database.

**Why it happens:** Supabase tracks migrations in the `supabase_migrations.schema_migrations` table. Manual schema changes or cleaning operations that touch this table (or related audit tables) corrupt the history.

**Consequences:**
- Cannot run new migrations
- CLI commands fail with cryptic errors
- Team members can't sync their local environments
- Emergency fixes become difficult to deploy

**Detection (warning signs):**
- `supabase migration status` shows mismatched versions
- `supabase db pull` fails with history errors
- New migrations won't apply even though they're valid

**Prevention:**

1. NEVER truncate or delete from `supabase_migrations` schema
2. Before cleanup, export current migration state:
```bash
supabase migration list > migration-backup.txt
```

3. Use proper data-only cleanup (not schema changes):
```sql
-- Safe: Delete data only
DELETE FROM repreneurs WHERE lifecycle_status = 'rejected';

-- Dangerous: Schema changes without migration
ALTER TABLE repreneurs DROP COLUMN old_field;
```

4. If history is corrupted, repair it:
```bash
supabase migration repair --status reverted [timestamp]
```

5. For major cleanup, consider a fresh project:
   - Export production data
   - Create new Supabase project
   - Run clean migrations
   - Import cleaned data

**Which phase should address:** Database Cleanup phase

**Sources:**
- [GitHub Discussion #40721 - Migration History Mismatch](https://github.com/orgs/supabase/discussions/40721)
- [Supabase Database Migrations Guide](https://supabase.com/docs/guides/deployment/database-migrations)

---

### Pitfall 6: Cascade Deletes Destroy More Than Expected

**What goes wrong:** Deleting a parent record (repreneur) cascades to delete all related records (notes, activities, offers), but also deletes records you wanted to preserve for analytics or audit.

**Why it happens:** `ON DELETE CASCADE` foreign keys are set up during initial development without considering long-term data retention needs.

**Consequences:**
- Historical data lost permanently
- Cannot analyze patterns from deleted users
- Compliance issues if audit trail required
- No way to recover accidentally deleted data

**Detection (warning signs):**
- Record counts in related tables suddenly drop
- Analytics dashboards show missing historical data
- Cannot find records you know existed

**Prevention:**

1. Before mass deletion, audit what will be affected:
```sql
-- Check what would be deleted
SELECT
  (SELECT COUNT(*) FROM notes WHERE repreneur_id IN (SELECT id FROM repreneurs WHERE lifecycle_status = 'rejected')) as notes_count,
  (SELECT COUNT(*) FROM activities WHERE repreneur_id IN (...)) as activities_count;
```

2. Consider soft deletes instead:
```sql
-- Add deleted_at column
ALTER TABLE repreneurs ADD COLUMN deleted_at TIMESTAMPTZ;

-- Query excludes deleted by default
SELECT * FROM repreneurs WHERE deleted_at IS NULL;
```

3. Export before deletion:
```bash
# Backup affected data
supabase db dump --data-only -t repreneurs -t notes > backup-$(date +%Y%m%d).sql
```

**Which phase should address:** Database Cleanup phase

---

### Pitfall 7: Email Relaunch Hits Deliverability Walls

**What goes wrong:** Mass email to existing candidates results in high bounce rates, spam complaints, and sender reputation damage. Subsequent emails land in spam even for engaged users.

**Why it happens:**
1. Old email addresses have become invalid (job changes, abandoned accounts)
2. No prior "warming" of email relationship
3. Sending to users who haven't engaged in 30+ days
4. Gmail/Yahoo 2025 authentication requirements not met

**Consequences:**
- 50%+ of emails go undelivered
- Domain gets flagged as spam sender
- Future transactional emails (password reset) fail
- Candidates think platform is abandoned

**Detection (warning signs):**
- Bounce rate above 2%
- Spam complaint rate above 0.1%
- Open rates below 10%
- Emails going to spam for previously-engaged users

**Prevention:**

1. Verify email list before sending:
```typescript
// Use email verification service
const validEmails = await verifyEmails(candidates.map(c => c.email))
// Remove invalid addresses BEFORE sending
```

2. Segment and stagger sends:
```
Day 1: Send to most recently active (last 30 days)
Day 3: Send to 30-60 day inactive
Day 7: Send to 60-90 day inactive
Skip: 90+ day inactive (verify emails first)
```

3. Ensure email authentication:
   - SPF record configured
   - DKIM signing enabled
   - DMARC policy set
   - Domain aligned with sending address

4. Monitor metrics after each batch:
```typescript
// Check bounce/complaint rates before continuing
const metrics = await getEmailMetrics(lastBatchId)
if (metrics.bounceRate > 0.02 || metrics.complaintRate > 0.001) {
  pauseSending()
  investigateIssue()
}
```

**Which phase should address:** Launch Preparation phase

**Sources:**
- [Gmail 2025 Email Authentication Requirements](https://www.emailindustries.com/email-deliverability/gmail-strengthens-bounce-policies-for-november-2025/)
- [Braze Email Deliverability Guide](https://www.braze.com/resources/articles/guide-to-2024-email-deliverability-updates-what-to-expect-from-gmail-and-yahoo-mail)

---

### Pitfall 8: Relaunch Email Sounds Like Spam

**What goes wrong:** Legitimate product update email gets ignored or marked as spam because it reads like generic marketing or an impersonal "system notification."

**Why it happens:**
- One-size-fits-all messaging
- Feature-focused instead of benefit-focused
- No personalization
- No acknowledgment of the gap/absence
- Generic subject line

**Consequences:**
- Low open rates (below 20%)
- High unsubscribe rates
- Damaged relationship with existing candidates
- Missed opportunity to re-engage

**Detection (warning signs):**
- Open rate below industry average (21% for B2B)
- High unsubscribe rate on first email
- No replies or engagement
- Candidates asking "what is this?" on other channels

**Prevention:**

1. Personalize with context:
```
WRONG: "Re-New Platform Update"
RIGHT: "Marie, votre profil Re-New a de nouvelles fonctionnalites"
```

2. Acknowledge the gap:
```
"We've been quiet for a few months while we rebuilt
the platform based on feedback from candidates like you."
```

3. Lead with benefit, not feature:
```
WRONG: "New questionnaire v2 with dual scoring"
RIGHT: "Complete your profile in 10 minutes (down from 30)"
```

4. Segment by engagement level:
   - Active (last 30 days): Brief update, direct link
   - Lapsed (30-90 days): Reintroduce, show what's new
   - Dormant (90+ days): Win-back offer, empathy-first

**Which phase should address:** Launch Preparation phase

**Sources:**
- [SaaS Product Launch Email Tactics 2025](https://www.dansiepen.io/growth-checklists/saas-product-updates-feature-launch-email-tactics)
- [SaaS Email Marketing Best Practices](https://ossisto.com/blog/saas-email-marketing-strategies/)

---

## Minor Pitfalls

Mistakes that cause annoyance but are recoverable.

---

### Pitfall 9: Next.js Config Doesn't Apply in Production

**What goes wrong:** `bodySizeLimit` and other `next.config.mjs` settings work locally but have no effect on Vercel.

**Why it happens:**
- Config changes require full redeploy (not just code push)
- Vercel caches build config
- Environment-specific overrides not applied

**Prevention:**
1. After config changes, trigger fresh build:
```bash
# Force full rebuild on Vercel
curl -X POST "https://api.vercel.com/v1/integrations/deploy/..."
```

2. Verify config is applied in production:
```typescript
// Add debug endpoint
export async function GET() {
  return Response.json({
    bodyLimit: process.env.BODY_SIZE_LIMIT || "default"
  })
}
```

**Which phase should address:** Any deployment phase

---

### Pitfall 10: Supabase Storage RLS Different from Database RLS

**What goes wrong:** Database queries work fine, but storage uploads fail with "unauthorized" even though user is authenticated.

**Why it happens:** Storage has its own RLS policies separate from database tables. Many developers forget to configure storage policies after setting up database policies.

**Prevention:**
1. Configure storage policies in Supabase Dashboard or via SQL:
```sql
CREATE POLICY "Public upload to cvs bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'cvs');
```

2. For admin-only uploads, use service role client:
```typescript
const adminClient = createAdminClient() // Uses service role key
await adminClient.storage.from("cvs").upload(path, buffer)
```

**Which phase should address:** File Upload Bug Fix phase

**Sources:**
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| File Upload Fixes | 15-byte files, 1MB limit | Convert to Buffer, increase config |
| Data Persistence | RLS silent failures | Use `.select()` after mutations |
| Database Cleanup | Migration history corruption | Export first, use data-only operations |
| Email Campaign | Deliverability issues | Verify list, segment, monitor metrics |
| Launch Day | Configuration not applied | Force fresh deploy, verify in production |

---

## Pre-Launch Checklist

Based on pitfalls above, verify before launch:

- [ ] File uploads tested with 5MB+ files in production
- [ ] Admin scoring edits persist after page refresh
- [ ] Database backup completed before any cleanup
- [ ] Email list verified (bounces removed)
- [ ] Test email sent to small segment first
- [ ] `next.config.mjs` changes deployed (check build logs)
- [ ] Storage RLS policies allow required operations
- [ ] Monitoring in place for email bounce/complaint rates

---

## Sources

**File Uploads:**
- [GitHub Issue #86 - Supabase Storage Next.js](https://github.com/supabase/storage/issues/86)
- [Next.js Server Actions Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [Supabase Storage Troubleshooting](https://supabase.com/docs/guides/storage/troubleshooting)

**Data Persistence:**
- [GitHub Discussion #37327 - UPDATE not persisting](https://github.com/orgs/supabase/discussions/37327)
- [Supabase RLS Troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8)

**Database Operations:**
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)

**Email Deliverability:**
- [Gmail 2025 Bounce Policies](https://www.emailindustries.com/email-deliverability/gmail-strengthens-bounce-policies-for-november-2025/)
- [Braze Deliverability Updates](https://www.braze.com/resources/articles/guide-to-2024-email-deliverability-updates-what-to-expect-from-gmail-and-yahoo-mail)
- [SaaS Email Tactics](https://www.dansiepen.io/growth-checklists/saas-product-updates-feature-launch-email-tactics)
