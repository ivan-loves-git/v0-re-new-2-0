---
status: pending
priority: p2
issue_id: "010"
tags: [security, code-review]
dependencies: []
---

# File Upload Security Issues

## Problem Statement

The avatar upload endpoint has two security issues:
1. It only checks the file type header (which users can fake), not the actual file content
2. It uses the file extension from user input, which could allow uploading malicious files

**Why it matters (non-technical):** Someone could upload a dangerous file disguised as an image. For example, they could upload a webpage with harmful code, name it "photo.jpg", and when someone views it, the code runs. It's like accepting a package labeled "birthday cake" without checking what's inside.

## Findings

**Location:** `app/api/upload-avatar/route.ts` lines 22-35

**Evidence:**
```typescript
// Only checks the Content-Type header (client can fake this)
if (!file.type.startsWith("image/")) {
  return NextResponse.json({ error: "File must be an image" }, { status: 400 })
}

// Uses file extension from user input
const fileExt = file.name.split(".").pop()  // User controls this!
const fileName = `${repreneurId}-${Date.now()}.${fileExt}`
```

**Discovery:** security-sentinel agent

## Proposed Solutions

### Option A: Whitelist Extensions + Verify Content (Recommended)
- **Pros:** Comprehensive protection
- **Cons:** Need to add file content checking
- **Effort:** Medium (1 hour)
- **Risk:** None

## Recommended Action

Option A - Implement both fixes

## Technical Details

**Affected files:**
- `app/api/upload-avatar/route.ts`

**Fix:**
```typescript
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const MAGIC_BYTES = {
  'jpg': [0xFF, 0xD8, 0xFF],
  'jpeg': [0xFF, 0xD8, 0xFF],
  'png': [0x89, 0x50, 0x4E, 0x47],
  'webp': [0x52, 0x49, 0x46, 0x46]  // RIFF header
}

export async function POST(request: Request) {
  // ... get file from form data ...

  // 1. Whitelist extension
  const fileExt = file.name.split(".").pop()?.toLowerCase()
  if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, and WebP images allowed" },
      { status: 400 }
    )
  }

  // 2. Verify actual file content matches claimed type
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const expectedBytes = MAGIC_BYTES[fileExt as keyof typeof MAGIC_BYTES]

  if (!expectedBytes || !expectedBytes.every((b, i) => bytes[i] === b)) {
    return NextResponse.json(
      { error: "File content does not match extension" },
      { status: 400 }
    )
  }

  // 3. Use sanitized extension for storage
  const fileName = `${repreneurId}-${Date.now()}.${fileExt}`

  // ... rest of upload logic ...
}
```

## Acceptance Criteria

- [ ] Only jpg, jpeg, png, webp extensions allowed
- [ ] File content is verified against extension
- [ ] Malicious files with fake extensions rejected
- [ ] Valid images upload successfully
- [ ] Error messages are user-friendly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during security audit |

## Resources

- Security review from security-sentinel agent
- [File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
