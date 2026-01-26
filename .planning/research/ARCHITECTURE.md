# Architecture Patterns: CRM Launch Readiness

**Domain:** Next.js + Supabase CRM (Re-New Platform)
**Researched:** 2026-01-26
**Focus:** Popup editing, file upload error handling, score recalculation, database cleanup

---

## 1. Popup/Modal Editing Architecture

### Recommended Pattern: Controlled Dialog with Local State

Based on the existing codebase patterns (`Tier1InlineEditor`, `QuestionnaireModal`) and [shadcn/ui Dialog best practices](https://ui.shadcn.com/docs/components/dialog), the recommended architecture is:

```
┌─────────────────────────────────────────────────────────┐
│                    Parent Component                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Trigger Button (DialogTrigger)                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Dialog (controlled via isOpen state)           │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │  DialogContent                          │    │    │
│  │  │  ┌─────────────────────────────────┐    │    │    │
│  │  │  │  Local Form State               │    │    │    │
│  │  │  │  (initialized from props)       │    │    │    │
│  │  │  └─────────────────────────────────┘    │    │    │
│  │  │  ┌─────────────────────────────────┐    │    │    │
│  │  │  │  Form Fields                    │    │    │    │
│  │  │  │  (update local state only)      │    │    │    │
│  │  │  └─────────────────────────────────┘    │    │    │
│  │  │  ┌─────────────────────────────────┐    │    │    │
│  │  │  │  Calculate & Save Button        │    │    │    │
│  │  │  │  (calls server action)          │    │    │    │
│  │  │  └─────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Component Structure for WHO/WHEN Popup Editors

**File:** `components/repreneurs/who-when-inline-editor.tsx`

```typescript
interface WhoWhenEditorProps {
  repreneur: Repreneur
}

export function WhoWhenInlineEditor({ repreneur }: WhoWhenEditorProps) {
  // State management
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Local form state (reset on dialog open)
  const [localAnswers, setLocalAnswers] = useState<WhoWhenAnswers>(() =>
    getInitialAnswers(repreneur)
  )

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) setLocalAnswers(getInitialAnswers(repreneur))
    setIsOpen(open)
  }

  // Update local state only (no server call)
  const handleLocalChange = (key: string, value: unknown) => {
    setLocalAnswers(prev => ({ ...prev, [key]: value }))
  }

  // Save all changes and recalculate
  const handleCalculate = async () => {
    startTransition(async () => {
      try {
        await updateWhoWhenAnswers(repreneur.id, localAnswers)
        toast.success("Score calculated and saved")
        setIsOpen(false)
      } catch (error) {
        toast.error("Failed to calculate score")
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* ... */}
    </Dialog>
  )
}
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Local state until save** | Prevents partial updates; user can cancel without side effects |
| **Reset on open** | Ensures fresh data each time; avoids stale state bugs |
| **`useTransition` for save** | Shows pending state without blocking UI |
| **`toast.success/error`** | Immediate feedback using sonner (already in codebase) |
| **Single "Calculate & Save" button** | Clear mental model: edit freely, then commit all at once |

### Existing Pattern Reference

The `Tier1InlineEditor` component (`/components/repreneurs/tier1-inline-editor.tsx`) already implements this pattern correctly. The WHO/WHEN editor should follow the same structure.

---

## 2. Score Recalculation Flow

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Edits Answers                        │
│                              │                                   │
│                              ▼                                   │
│           ┌─────────────────────────────────────┐               │
│           │      Local State Updates            │               │
│           │      (no server call yet)           │               │
│           └─────────────────────────────────────┘               │
│                              │                                   │
│                              ▼                                   │
│                    User clicks "Calculate & Save"                │
│                              │                                   │
│                              ▼                                   │
│           ┌─────────────────────────────────────┐               │
│           │       Server Action Called          │               │
│           │     updateWhoWhenAnswers(id, data)  │               │
│           └─────────────────────────────────────┘               │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│  ┌─────────────────────┐      ┌─────────────────────────┐      │
│  │  1. Update answers  │      │  2. Calculate scores    │      │
│  │     in database     │      │     using scoring-v2    │      │
│  └─────────────────────┘      └─────────────────────────┘      │
│              │                               │                  │
│              └───────────────┬───────────────┘                  │
│                              ▼                                   │
│           ┌─────────────────────────────────────┐               │
│           │  3. Update scores & breakdown       │               │
│           │     who_score, when_score           │               │
│           │     who_score_breakdown             │               │
│           │     when_score_breakdown            │               │
│           │     scoring_flags                   │               │
│           │     recommendation                  │               │
│           └─────────────────────────────────────┘               │
│                              │                                   │
│                              ▼                                   │
│           ┌─────────────────────────────────────┐               │
│           │  4. revalidatePath()                │               │
│           │     - /repreneurs                   │               │
│           │     - /repreneurs/[id]              │               │
│           │     - /pipeline                     │               │
│           │     - /dashboard                    │               │
│           └─────────────────────────────────────┘               │
│                              │                                   │
│                              ▼                                   │
│                    Return score breakdown                        │
│                              │                                   │
│                              ▼                                   │
│               UI shows toast + closes dialog                     │
└─────────────────────────────────────────────────────────────────┘
```

### Server Action Pattern

**File:** `lib/actions/repreneurs.ts`

```typescript
/**
 * Update WHO/WHEN answers and recalculate dual scores
 * Pattern: Batch update + recalculate + single DB write
 */
export async function updateWhoWhenAnswers(
  id: string,
  answers: WhoWhenInput
) {
  const supabase = createAdminClient()

  // 1. Calculate scores from new answers
  const whoAnswers = extractWhoAnswers(answers)
  const whenAnswers = extractWhenAnswers(answers)
  const dualScore = calculateDualScore(whoAnswers, whenAnswers)

  // 2. Single atomic update (answers + scores)
  const { error } = await supabase
    .from("repreneurs")
    .update({
      // WHO answers
      q05_status: answers.q05_status,
      q06_experience: answers.q06_experience,
      // ... other WHO fields

      // WHEN answers
      q11_project_status: answers.q11_project_status,
      // ... other WHEN fields

      // Calculated scores
      who_score: dualScore.who.score,
      when_score: dualScore.when.score,
      who_score_breakdown: dualScore.who.breakdown,
      when_score_breakdown: dualScore.when.breakdown,
      scoring_flags: dualScore.flags.flags,
      recommendation: dualScore.recommendation,
    })
    .eq("id", id)

  if (error) throw new Error(error.message)

  // 3. Revalidate affected paths
  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
  revalidatePath("/dashboard")

  return dualScore
}
```

### Key Principles

1. **Atomic updates**: All related fields updated in single DB call
2. **Calculate before save**: Score computation happens in server action, not client
3. **Return the result**: Client receives new scores for immediate UI feedback
4. **Revalidate broadly**: Pipeline and dashboard depend on scores

---

## 3. File Upload Error Handling

### Current State Analysis

The existing `/api/upload-cv/route.ts` handles basic validation but lacks:
- Retry logic on transient failures
- Detailed error messages for different failure modes
- Client-side progress/retry UI

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Component                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  FileUploader                                            │    │
│  │  - File validation (type, size)                          │    │
│  │  - Upload state: idle | uploading | error | success      │    │
│  │  - Error message display                                 │    │
│  │  - Retry button (on error)                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  fetch("/api/upload-cv", { method: "POST", ... })        │    │
│  │  with retry wrapper (max 3 attempts)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Route                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  POST /api/upload-cv                                     │    │
│  │  1. Validate file type & size                            │    │
│  │  2. Validate repreneur exists                            │    │
│  │  3. Upload to Supabase Storage                           │    │
│  │  4. Return URL or structured error                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Storage                             │
│                     (cvs bucket)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Improved Error Response Structure

```typescript
// API route returns structured errors
type UploadResponse =
  | { success: true; url: string }
  | { success: false; error: UploadError }

type UploadError = {
  code: "INVALID_TYPE" | "FILE_TOO_LARGE" | "STORAGE_ERROR" | "UNKNOWN"
  message: string
  retryable: boolean
}

// Example responses:
{ success: false, error: { code: "INVALID_TYPE", message: "File must be PDF or Word", retryable: false } }
{ success: false, error: { code: "STORAGE_ERROR", message: "Upload failed", retryable: true } }
```

### Client-Side Retry Pattern

Based on [Next.js Server Actions error handling patterns](https://github.com/vercel/next.js/discussions/49426):

```typescript
// components/repreneurs/document-uploader.tsx

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // ms

async function uploadWithRetry(
  formData: FormData,
  attempt = 1
): Promise<UploadResponse> {
  try {
    const response = await fetch("/api/upload-cv", {
      method: "POST",
      body: formData,
    })

    const result = await response.json()

    // If retryable error and attempts remaining, retry
    if (!result.success && result.error.retryable && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY * attempt))
      return uploadWithRetry(formData, attempt + 1)
    }

    return result
  } catch (networkError) {
    // Network errors are retryable
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY * attempt))
      return uploadWithRetry(formData, attempt + 1)
    }
    return {
      success: false,
      error: { code: "UNKNOWN", message: "Network error", retryable: false }
    }
  }
}
```

### UI States for Upload

```typescript
type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress?: number }
  | { status: "error"; error: UploadError; canRetry: boolean }
  | { status: "success"; url: string }
```

---

## 4. Database Export/Cleanup Workflow

### Safe Cleanup Sequence

Based on [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups) and [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore):

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1: EXPORT                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1. Document what will be deleted                        │    │
│  │     - Query: SELECT * FROM repreneurs WHERE <condition>  │    │
│  │     - Count: SELECT COUNT(*) FROM repreneurs WHERE ...   │    │
│  │                                                          │    │
│  │  2. Export to JSON file with timestamp                   │    │
│  │     - npx tsx scripts/export-before-cleanup.ts           │    │
│  │     - Output: backups/cleanup-2026-01-26-repreneurs.json │    │
│  │                                                          │    │
│  │  3. Verify export file is valid                          │    │
│  │     - Parse JSON, check record count matches             │    │
│  │     - Save to version control or secure storage          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 2: VALIDATE                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  4. Human review of export                               │    │
│  │     - Check for false positives                          │    │
│  │     - Confirm cleanup criteria are correct               │    │
│  │                                                          │    │
│  │  5. Dry-run cleanup (optional)                           │    │
│  │     - Run cleanup query with RETURNING                   │    │
│  │     - Compare IDs with export                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 3: CLEANUP                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  6. Run cleanup with transaction                         │    │
│  │     BEGIN;                                               │    │
│  │       DELETE FROM repreneurs WHERE <condition>;          │    │
│  │     -- Check affected count before COMMIT                │    │
│  │     COMMIT;                                              │    │
│  │                                                          │    │
│  │  7. Log results                                          │    │
│  │     - Timestamp, count deleted, user who ran it          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 4: VERIFY                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  8. Post-cleanup verification                            │    │
│  │     - Query remaining records                            │    │
│  │     - Check no unintended deletions                      │    │
│  │     - Test application functionality                     │    │
│  │                                                          │    │
│  │  9. Archive backup file                                  │    │
│  │     - Move to long-term storage                          │    │
│  │     - Document cleanup in project notes                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Export Script Template

**File:** `scripts/export-before-cleanup.ts`

```typescript
import { createAdminClient } from "@/lib/supabase/admin"
import * as fs from "fs"
import * as path from "path"

interface ExportOptions {
  table: string
  condition: string  // SQL WHERE clause
  description: string
}

async function exportBeforeCleanup(options: ExportOptions) {
  const supabase = createAdminClient()
  const timestamp = new Date().toISOString().slice(0, 10)

  // 1. Count records
  const { count } = await supabase
    .from(options.table)
    .select("*", { count: "exact", head: true })
    // Note: condition would need to be applied via RPC or raw SQL

  console.log(`Found ${count} records matching condition`)

  // 2. Export records
  const { data, error } = await supabase
    .from(options.table)
    .select("*")
    // Apply condition

  if (error) throw error

  // 3. Write to file
  const backupDir = path.join(process.cwd(), "backups")
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir)

  const filename = `cleanup-${timestamp}-${options.table}.json`
  const filepath = path.join(backupDir, filename)

  const exportData = {
    exportedAt: new Date().toISOString(),
    description: options.description,
    condition: options.condition,
    recordCount: data?.length || 0,
    data,
  }

  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2))

  console.log(`Exported ${data?.length} records to ${filepath}`)

  // 4. Verify file
  const verification = JSON.parse(fs.readFileSync(filepath, "utf-8"))
  if (verification.data.length !== data?.length) {
    throw new Error("Export verification failed: record count mismatch")
  }

  return { filepath, count: data?.length || 0 }
}

// Usage example
exportBeforeCleanup({
  table: "repreneurs",
  condition: "lifecycle_status = 'rejected' AND rejected_at < now() - interval '90 days'",
  description: "Cleanup rejected repreneurs older than 90 days",
})
```

### Cleanup Script with Safety Checks

**File:** `scripts/cleanup-rejected.ts`

```typescript
import { createAdminClient } from "@/lib/supabase/admin"

interface CleanupOptions {
  table: string
  condition: string
  dryRun?: boolean
}

async function cleanupWithSafety(options: CleanupOptions) {
  const supabase = createAdminClient()

  // 1. Check export exists
  const exportFile = findLatestExport(options.table)
  if (!exportFile) {
    throw new Error("No export file found. Run export-before-cleanup.ts first.")
  }

  // 2. Count to be deleted
  const { count } = await supabase
    .from(options.table)
    .select("*", { count: "exact", head: true })
    // Apply condition

  console.log(`Will delete ${count} records`)

  // 3. Dry run or real delete
  if (options.dryRun) {
    console.log("DRY RUN - no records deleted")
    return { deleted: 0, dryRun: true }
  }

  // 4. Prompt for confirmation
  const confirm = await promptUser(`Delete ${count} records? (yes/no)`)
  if (confirm !== "yes") {
    console.log("Aborted by user")
    return { deleted: 0, aborted: true }
  }

  // 5. Delete with RETURNING to log IDs
  const { data: deleted, error } = await supabase
    .from(options.table)
    .delete()
    .select("id")
    // Apply condition

  if (error) throw error

  // 6. Log results
  console.log(`Deleted ${deleted?.length} records`)
  console.log(`IDs: ${deleted?.map(r => r.id).join(", ")}`)

  return { deleted: deleted?.length || 0 }
}
```

---

## 5. Anti-Patterns to Avoid

### Popup Editing Anti-Patterns

| Anti-Pattern | Why Bad | Instead |
|--------------|---------|---------|
| Saving on every field change | Partial updates, race conditions | Batch save with "Calculate" button |
| Not resetting state on open | Stale data from previous edit | Reset local state in `onOpenChange` |
| Using `formAction` in Dialog | Portal issues with forms | Use `onClick` + server action |
| Nested dialogs | Confusing UX, portal issues | Use wizard/stepper pattern |

### File Upload Anti-Patterns

| Anti-Pattern | Why Bad | Instead |
|--------------|---------|---------|
| No client-side validation | Wasted server trips | Validate type/size before upload |
| Generic error messages | Users can't fix the problem | Specific error codes + messages |
| No retry on transient errors | Network hiccups cause failures | Auto-retry with backoff |
| Blocking UI during upload | Bad UX on slow connections | Show progress, allow cancel |

### Database Cleanup Anti-Patterns

| Anti-Pattern | Why Bad | Instead |
|--------------|---------|---------|
| Delete without export | Data loss is permanent | Always export first |
| No count verification | Could delete unexpected records | Compare counts before/after |
| No transaction | Partial cleanup on error | Wrap in BEGIN/COMMIT |
| No documentation | Future devs won't know what was deleted | Log everything |

---

## 6. Component Boundaries

### Recommended File Structure

```
components/repreneurs/
├── who-when-inline-editor.tsx    # NEW: Combined WHO/WHEN popup editor
├── tier1-inline-editor.tsx       # EXISTING: Legacy score editor
├── documents-card.tsx            # EXISTING: File uploads
├── questionnaire-form-v2.tsx     # EXISTING: Full questionnaire form
└── ...

lib/actions/
├── repreneurs.ts                 # Add: updateWhoWhenAnswers()
└── ...

scripts/
├── export-before-cleanup.ts      # NEW: Safe export script
├── cleanup-rejected.ts           # NEW: Safe cleanup script
└── ...

backups/                          # NEW: Directory for export files
├── cleanup-2026-01-26-repreneurs.json
└── ...
```

---

## 7. Summary: Roadmap Implications

### Phase Structure Recommendations

Based on this architecture research:

1. **WHO/WHEN Popup Editor** (Low complexity)
   - Copy pattern from `Tier1InlineEditor`
   - Add new server action `updateWhoWhenAnswers`
   - Wire up to profile page

2. **File Upload Improvements** (Medium complexity)
   - Add structured error responses to API route
   - Add retry logic to `DocumentsCard`
   - Better error messages in UI

3. **Database Cleanup** (Medium complexity, HIGH CAUTION)
   - Create export script first
   - Test on small dataset
   - Document cleanup criteria

### Quality Gate Verification

- [x] Popup architecture works with existing shadcn/ui patterns (verified in `Tier1InlineEditor`)
- [x] Score recalculation flow is clear (pattern exists in `saveQuestionnaireV2`)
- [x] Export/cleanup sequence is safe (export first, verify, then clean)

---

## Sources

### HIGH Confidence (Official Documentation)
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
- [Next.js Server Actions](https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Supabase Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI Backup/Restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [TanStack Query Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

### MEDIUM Confidence (Community + Official)
- [Next.js Error Handling Discussion](https://github.com/vercel/next.js/discussions/49426)
- [React Server Actions with Toast](https://www.robinwieruch.de/react-server-actions-toast/)
- [shadcn Dialog with Form Tips](https://blog.greenroots.info/shadcn-dialog-with-form-three-tips)

### Codebase References (Existing Patterns)
- `/components/repreneurs/tier1-inline-editor.tsx` - Popup editor pattern
- `/components/repreneurs/questionnaire-modal.tsx` - Multi-step dialog pattern
- `/lib/actions/repreneurs.ts` - Server action patterns
- `/components/repreneurs/documents-card.tsx` - File upload component
- `/app/api/upload-cv/route.ts` - Upload API route
