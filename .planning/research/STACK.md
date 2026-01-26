# Technology Stack Research: CRM Bug Fixes & Polish

**Project:** Re-New Platform (Wave 2)
**Researched:** January 26, 2026
**Focus:** File uploads, modal editing, database export

---

## Executive Summary

This research addresses three technical areas needed for the Re-New CRM bug fix phase:

1. **File uploads** are failing because step-contact.tsx calls `/api/upload` but the actual route is `/api/upload-cv`. Beyond this routing issue, the current implementation is solid but lacks upload progress feedback.

2. **Modal editing** already has a working pattern in `tier1-inline-editor.tsx` using shadcn Dialog with controlled state. This pattern should be reused for WHO/WHEN parameter editors.

3. **Database export** is straightforward with Supabase CLI's `db dump` command or direct `pg_dump` for pre-cleanup backups.

---

## 1. File Upload Patterns (Next.js 16 + Supabase Storage)

### Current Implementation Analysis

**Confidence: HIGH** (verified against codebase)

The project has two upload routes:
- `/api/upload-cv/route.ts` - Handles CV/document uploads (PDF, DOC, DOCX up to 10MB)
- `/api/upload-avatar/route.ts` - Handles avatar images (JPG, PNG, WebP, GIF up to 5MB)

**Critical Bug Found:** `step-contact.tsx` line 57 calls `/api/upload` but should call `/api/upload-cv`. This is why file uploads are failing.

```typescript
// Current (broken):
const response = await fetch('/api/upload', { ... })

// Should be:
const response = await fetch('/api/upload-cv', { ... })
```

### Recommended Upload Pattern

**Confidence: HIGH** (verified with Supabase docs)

#### For Files Under 6MB (Standard Upload)

Use the existing API route pattern with admin client bypass for public forms:

```typescript
// Server-side (API route)
const { error } = await adminClient.storage
  .from('bucket-name')
  .upload(filePath, buffer, {
    contentType: file.type,
    upsert: true,  // Replace existing files
  })
```

**Why admin client?** Public intake forms have no authenticated user. The service role key bypasses RLS policies.

#### For Files Over 6MB (Signed URL Upload)

Use signed upload URLs to bypass Next.js body size limits (default 1MB for Server Actions):

```typescript
// Server Action to get signed URL
export async function getSignedUploadUrl(fileName: string, repreneurId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from('cvs')
    .createSignedUploadUrl(`cvs/${repreneurId}/${fileName}`)
  return { data, error: error?.message }
}

// Client-side direct upload
const { data: signedUrl } = await getSignedUploadUrl(file.name, repreneurId)
await supabase.storage.from('cvs').uploadToSignedUrl(
  signedUrl.path,
  signedUrl.token,
  file
)
```

**When to use:** Files larger than 6MB, or when you need upload progress tracking.

### Upload Progress Implementation

**Confidence: MEDIUM** (verified pattern, not Supabase-specific)

The Fetch API does NOT support upload progress events. Use XMLHttpRequest or Axios:

```typescript
// Using XMLHttpRequest for progress
function uploadWithProgress(
  file: File,
  url: string,
  onProgress: (percent: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => resolve(new Response(xhr.response))
    xhr.onerror = () => reject(new Error('Upload failed'))

    xhr.open('POST', url)
    xhr.send(formData)
  })
}
```

### Error Handling Checklist

1. **File type validation** - Already implemented with ALLOWED_TYPES
2. **File size validation** - Already implemented (10MB for docs, 5MB for images)
3. **Magic bytes verification** - Only in avatar upload, could add to CV upload
4. **Network errors** - Wrap in try/catch, show user-friendly message
5. **Storage errors** - Log full error, return generic message to client

### Supabase Storage Security

**Confidence: HIGH** (verified with Supabase docs)

| Bucket | Public? | Who Uploads | Pattern |
|--------|---------|-------------|---------|
| `cvs` | No | Public users (intake form) | Admin client bypass |
| `avatars` | Yes | Authenticated admins | Server client with RLS |

**RLS Policy for authenticated uploads:**
```sql
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');
```

---

## 2. Modal/Popup Editing Patterns

### Existing Pattern: Tier1InlineEditor

**Confidence: HIGH** (verified against codebase)

The project already has an excellent modal editing pattern in `/components/repreneurs/tier1-inline-editor.tsx`:

```typescript
// Key pattern elements:
export function Tier1InlineEditor({ repreneur }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [localAnswers, setLocalAnswers] = useState<LocalAnswers>(getInitialAnswers)

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) setLocalAnswers(getInitialAnswers())
    setIsOpen(open)
  }

  // Save with useTransition for loading state
  const handleSave = async () => {
    startTransition(async () => {
      await updateTier1Answers(repreneur.id, localAnswers)
      setIsOpen(false)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Form fields */}
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Calculator />}
            Calculate & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Pattern for WHO/WHEN Parameter Editors

**Confidence: HIGH** (extrapolation from working pattern)

Reuse the same structure. Key components:

| Component | Purpose | From |
|-----------|---------|------|
| `Dialog` | Modal container | shadcn/ui |
| `DialogTrigger` | Opens modal (pencil icon) | shadcn/ui |
| `DialogContent` | Modal body with max-height | shadcn/ui |
| `Select` | Single-choice dropdowns | shadcn/ui |
| `Popover + Command` | Multi-select with search | shadcn/ui |
| `Switch` | Boolean yes/no toggles | shadcn/ui |

### Field Type Components (Already Built)

The project already has reusable field components in tier1-inline-editor.tsx:

```typescript
// For single select (WHO parameters)
<SelectField
  value={localAnswers[key]}
  options={OPTIONS}
  onChange={(v) => handleLocalChange(key, v)}
/>

// For multi-select (sector targeting)
<MultiSelectField
  value={localAnswers[key] || []}
  options={OPTIONS}
  onChange={(v) => handleLocalChange(key, v)}
  searchable={true}
/>

// For boolean (yes/no questions)
<BooleanField
  value={localAnswers[key]}
  onChange={(v) => handleLocalChange(key, v)}
/>
```

### React Hook Form Integration (Optional)

**Confidence: MEDIUM** (verified with shadcn docs)

For complex validation, wrap in React Hook Form:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  employmentStatus: z.string().min(1, 'Required'),
  yearsExperience: z.string().min(1, 'Required'),
})

function EditorWithValidation() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: getInitialValues()
  })

  // For dialog button submission:
  const handleDialogSubmit = async () => {
    await form.trigger()  // Validate all fields
    if (form.formState.isValid) {
      // Proceed with save
    }
  }
}
```

**Note:** The current Tier1InlineEditor does NOT use React Hook Form. It uses simple useState which is sufficient for this use case.

### Dialog + Recalculation Pattern

When edits trigger score recalculation:

```typescript
const handleCalculate = async () => {
  startTransition(async () => {
    try {
      // Server action handles both update AND recalculation
      await updateTier1Answers(repreneur.id, localAnswers)
      toast.success("Score calculated and saved")
      setIsOpen(false)
    } catch (error) {
      toast.error("Failed to calculate score")
    }
  })
}
```

The server action (`updateTier1Answers`) should:
1. Update individual fields in database
2. Recalculate WHO/WHEN scores
3. Update total score
4. Return updated repreneur data

---

## 3. Database Export/Backup Patterns

### Pre-Cleanup Backup (Recommended)

**Confidence: HIGH** (verified with Supabase docs)

Before any data cleanup operation, take a full backup:

#### Option 1: Supabase CLI (Simplest)

```bash
# Link project first
supabase link --project-ref your-project-ref

# Full dump including data
supabase db dump --data-only > backup-$(date +%Y%m%d).sql

# Schema only (no data)
supabase db dump > schema-$(date +%Y%m%d).sql
```

**Note:** CLI excludes Supabase-managed schemas (auth, storage) by default.

#### Option 2: Direct pg_dump (Full Control)

```bash
# Get connection string from Supabase Dashboard > Settings > Database

pg_dump "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require" \
  -F c \
  -b \
  -v \
  -f backup-$(date +%Y%m%d).dump

# For specific tables only
pg_dump "..." \
  -t repreneurs \
  -t notes \
  -F c \
  -f repreneurs-backup.dump
```

#### Option 3: CSV Export (For Sharing)

Via Supabase Dashboard:
1. Go to Table Editor
2. Select table
3. Click "Export to CSV"

Or via SQL:
```sql
COPY (SELECT * FROM repreneurs) TO '/tmp/repreneurs.csv' WITH CSV HEADER;
```

### Restore Procedure

```bash
# From SQL dump
psql "postgresql://..." < backup.sql

# From custom format dump
pg_restore -d "postgresql://..." backup.dump
```

### Automated Backup Script

For GitHub Actions:

```yaml
name: Daily Backup
on:
  schedule:
    - cron: '0 0 * * *'  # Midnight UTC
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase db dump --data-only > backup.sql
      - uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_number }}
          path: backup.sql
```

### Important Caveats

| What | Included? | Notes |
|------|-----------|-------|
| Table data | Yes | Via `--data-only` flag |
| Schema | Yes | Default behavior |
| Storage files | NO | Backed up separately |
| Auth users | NO | Supabase-managed |
| RLS policies | Yes | Part of schema |
| Custom roles | NO | Requires `--role-only` |

**Storage files** must be backed up separately if needed:
```bash
# List all files in bucket
supabase storage ls cvs --project-ref your-ref

# Download manually or use API
```

---

## Recommendations for Phase Planning

### Immediate Fixes (Phase 1)

1. **Fix upload route** - Change `/api/upload` to `/api/upload-cv` in step-contact.tsx
2. **Add error logging** - Enhance error messages for debugging

### Short-term Improvements (Phase 2)

1. **Add upload progress** - Use XMLHttpRequest for progress feedback
2. **Create WHO/WHEN editors** - Clone Tier1InlineEditor pattern
3. **Take pre-cleanup backup** - Run `supabase db dump` before any data migration

### Future Considerations

1. **Resumable uploads** - Only needed if files exceed 6MB regularly
2. **Form validation** - Add React Hook Form if validation complexity increases
3. **Automated backups** - Set up GitHub Actions for daily backups

---

## Sources

### File Uploads
- [Supabase Storage Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) - Official docs (HIGH confidence)
- [Supabase Storage Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) - Official docs (HIGH confidence)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) - RLS policies (HIGH confidence)
- [Signed URL Uploads with Next.js](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0) - Pattern reference (MEDIUM confidence)
- [XMLHttpRequest Progress Event](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequestEventTarget/progress_event) - MDN docs (HIGH confidence)

### Modal/Dialog Patterns
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog) - Official docs (HIGH confidence)
- [shadcn/ui Form](https://ui.shadcn.com/docs/components/form) - Official docs (HIGH confidence)
- [Dialog + Form Pattern](https://github.com/shadcn-ui/ui/discussions/2918) - Community discussion (MEDIUM confidence)

### Database Export
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups) - Official docs (HIGH confidence)
- [Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump) - CLI reference (HIGH confidence)
- [Automated Backups with GitHub Actions](https://supabase.com/docs/guides/deployment/ci/backups) - Official docs (HIGH confidence)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| File Upload Routing Bug | HIGH | Verified in codebase |
| Upload Progress Pattern | MEDIUM | Verified pattern, not tested in this stack |
| Modal Editing Pattern | HIGH | Existing implementation in codebase |
| Database Export | HIGH | Verified with Supabase official docs |
| Signed URL Uploads | HIGH | Official Supabase documentation |
