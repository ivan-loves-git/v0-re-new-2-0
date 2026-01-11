# Documents Management System

---
title: Documents Management System (CV + Lettre de Cadrage)
problem_type: feature_implementation
components:
  - documents-card.tsx
  - upload-cv/route.ts
  - repreneur-avatar.tsx
  - Supabase Storage
tags:
  - file-upload
  - supabase-storage
  - pdf
  - documents
  - avatar
severity: medium
date_solved: 2026-01-10
task_id: 48
build: 135.5bd8016
---

## Problem Statement

The platform needed document management capabilities for repreneurs:
1. CV upload during public intake form (PDF only)
2. CV and Lettre de Cadrage (LDC) management on profile page
3. Custom profile photo uploads with deterministic defaults

## Solution Overview

### Components Built

| Component | Purpose |
|-----------|---------|
| `components/repreneurs/documents-card.tsx` | Documents card with CV + LDC management |
| `app/api/upload-cv/route.ts` | API route for document upload/delete |
| `app/api/upload-avatar/route.ts` | API route for avatar upload |
| `components/ui/repreneur-avatar.tsx` | Avatar with upload dialog |

### Database Migrations

```sql
-- Migration 016: Add CV URL column
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS cv_url TEXT;

-- Migration 017: Create cvs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO NOTHING;

-- Migration 018: Add LDC URL column
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ldc_url TEXT;
```

### Combined SQL for Storage Setup

```sql
-- CVs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cvs');

CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'cvs');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'cvs');

CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'cvs');

-- Avatars bucket (same pattern)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- (Same RLS policies for avatars bucket)
```

## Key Implementation Details

### Documents Card Component

```tsx
// components/repreneurs/documents-card.tsx
function DocumentRow({ repreneurId, label, field, url }: DocumentRowProps) {
  const handleUpload = async (file: File) => {
    // Validate PDF only
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file")
      return
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB")
      return
    }

    // Upload to API
    const formData = new FormData()
    formData.append("file", file)
    formData.append("repreneurId", repreneurId)

    const response = await fetch("/api/upload-cv", {
      method: "POST",
      body: formData,
    })

    const { url: newUrl } = await response.json()
    await updateRepreneurField(repreneurId, field, newUrl)
  }
}
```

### Avatar System with Deterministic Defaults

```tsx
// 16 default Notion-style avatars
const TOTAL_DEFAULT_AVATARS = 16

function getDefaultAvatarNumber(repreneurId: string): number {
  let hash = 0
  for (let i = 0; i < repreneurId.length; i++) {
    const char = repreneurId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash % TOTAL_DEFAULT_AVATARS) + 1
}

// Usage: Shows `/avatars/default-{n}.png` when no custom avatar
const imageSrc = currentAvatarUrl || `/avatars/default-${defaultAvatarNumber}.png`
```

## File Structure

```
app/
  api/
    upload-cv/route.ts      # Document upload/delete
    upload-avatar/route.ts  # Avatar upload
components/
  repreneurs/
    documents-card.tsx      # Documents management card
  ui/
    repreneur-avatar.tsx    # Avatar with edit dialog
public/
  avatars/
    default-1.png ... default-16.png  # Notion-style faces
scripts/
  016_add_cv_url_column.sql
  017_setup_cv_storage.sql
  018_add_ldc_url_column.sql
  009_setup_avatar_storage.sql
```

## Prevention Strategies

### Before Testing Uploads

Always run the combined SQL to create storage buckets:
1. Create bucket with `INSERT INTO storage.buckets`
2. Add RLS policies for INSERT, UPDATE, DELETE, SELECT
3. Verify bucket exists in Supabase Dashboard > Storage

### File Validation

- **Intake form**: PDF only (strict)
- **Profile page**: PDF and Word accepted
- **Avatars**: Images only (jpg, png, etc.)
- **Size limits**: 10MB for documents, 5MB for avatars

### Fallback Behavior

- **No custom avatar**: Shows deterministic default (1 of 16)
- **Delete custom avatar**: Resets to deterministic default
- **Upload failure**: Shows toast error, keeps previous state

## Test Cases

1. **Upload PDF in intake form**: Should succeed
2. **Upload Word doc in intake form**: Should reject with error
3. **Upload CV on profile**: Should show View/Upload/Delete buttons
4. **Delete document**: Should show "No file uploaded" state
5. **Click avatar**: Should open Change Profile Photo dialog
6. **Upload custom photo**: Should replace default
7. **Reset to default**: Should show trash icon (only when custom exists)

## Related Tasks

- **Task 48**: User Profile Pictures & CV Upload System (completed)
- **Task 29**: Supabase Storage Bucket for Avatar Uploads (completed)
- **Task 44**: Avatar Redesign with Notion Face Style (completed)

## Related Roadmap Entries

- v0.9.6: Documents Management
- v0.9.7: Email System Live (includes founder notifications about new features)
