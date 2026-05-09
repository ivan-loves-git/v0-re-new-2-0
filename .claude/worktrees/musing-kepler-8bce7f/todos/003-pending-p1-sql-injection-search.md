---
status: pending
priority: p1
issue_id: "003"
tags: [security, code-review, critical]
dependencies: []
---

# SQL Injection Risk in Search Query

## Problem Statement

User search input is directly inserted into database queries without sanitization. Special characters could manipulate query behavior or cause errors.

**Why it matters (non-technical):** When someone types in the search box, their text goes directly into the database query. A malicious user could type special characters that trick the database into showing data it shouldn't, or crash the search feature.

## Findings

**Location:** `lib/actions/emails.ts` line 223

```typescript
query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
```

**Discovery:** security-sentinel agent

**Evidence:** The `search` variable from user input is directly interpolated into the query string. Characters like `%`, `_`, `'` could cause issues.

## Proposed Solutions

### Option A: Escape Special Characters (Recommended)
- **Pros:** Simple fix, maintains existing functionality
- **Cons:** None
- **Effort:** Small (30 min)
- **Risk:** None

### Option B: Use Parameterized Query
- **Pros:** Most secure approach
- **Cons:** May require restructuring query
- **Effort:** Medium (1 hour)
- **Risk:** Low

## Recommended Action

Option A - Escape special characters before interpolation

## Technical Details

**Affected files:**
- `lib/actions/emails.ts`

**Fix:**
```typescript
// Before query construction, escape special characters
const escapedSearch = search
  .replace(/\\/g, '\\\\')  // Escape backslashes first
  .replace(/%/g, '\\%')    // Escape percent signs
  .replace(/_/g, '\\_')    // Escape underscores

query = query.or(`first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`)
```

## Acceptance Criteria

- [ ] Search works normally with regular text
- [ ] Special characters like `%`, `_`, `'` are escaped
- [ ] Search for "test%" finds "test%" literally, not all records starting with "test"
- [ ] No errors when searching with special characters

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during security audit |

## Resources

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
