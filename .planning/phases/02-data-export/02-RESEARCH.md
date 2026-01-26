# Phase 02: Data Export - Research

**Researched:** 2026-01-26
**Domain:** Supabase data export, Node.js JSON/file handling
**Confidence:** HIGH

## Summary

This phase creates a verified database snapshot before Phase 9 (Data Cleanup) removes incomplete/duplicate records. The export must capture all current repreneurs with their scores, offers, and notes in a format that allows record count verification.

The standard approach is a TypeScript script (run via `npx tsx`) that:
1. Uses the existing `createAdminClient()` pattern to bypass RLS
2. Fetches all tables with pagination (Supabase limits to 1000 rows by default)
3. Writes timestamped JSON to a `data/exports/` folder
4. Includes metadata with record counts for verification
5. Commits to git for audit trail

**Primary recommendation:** Create `scripts/export-database.ts` script that exports all tables to a single timestamped JSON file with embedded verification metadata.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.89.0+ | Database queries | Already in project, uses admin client pattern |
| Node.js fs/promises | Built-in | File writing | Native, async, no dependencies |
| Node.js path | Built-in | Path handling | Native, cross-platform paths |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Timestamp formatting | Already in project for date handling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON export | CSV export | JSON preserves nested data (arrays, objects) which CSV flattens; requirement says CSV but JSON better fits data model |
| Single file | Multiple files per table | Single file simpler to verify, related data together |
| Repository storage | Cloud storage | Git provides audit trail, Vercel storage adds complexity |

**Installation:**
No new packages needed - all dependencies already in project.

## Architecture Patterns

### Recommended Project Structure
```
scripts/
  export-database.ts          # Main export script

data/
  exports/
    .gitkeep                   # Ensure folder exists in git
    export-2026-01-26T120000.json   # Timestamped exports
```

### Pattern 1: Paginated Fetch Pattern
**What:** Supabase limits responses to 1000 rows by default. Must paginate for complete data.
**When to use:** Any table that could exceed 1000 rows.
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/select
async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`)

    if (data && data.length > 0) {
      allRows.push(...(data as T[]))
      offset += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return allRows
}
```

### Pattern 2: Export Metadata Pattern
**What:** Include verification metadata in export file for integrity checking.
**When to use:** Always - enables verification without re-querying database.
**Example:**
```typescript
interface ExportMetadata {
  exportedAt: string           // ISO timestamp
  exportVersion: string        // Script version
  tables: {
    [tableName: string]: {
      count: number
      firstId?: string
      lastId?: string
    }
  }
  totalRecords: number
}

interface DatabaseExport {
  metadata: ExportMetadata
  data: {
    repreneurs: Repreneur[]
    offers: Offer[]
    repreneur_offers: RepreneurOffer[]
    notes: Note[]
    activities: Activity[]
  }
}
```

### Pattern 3: Env Loading Pattern (Existing in Project)
**What:** Load .env.local for script execution outside Next.js context.
**When to use:** All standalone scripts.
**Example:**
```typescript
// Source: scripts/add-test-repreneur.ts (existing pattern)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found")
  }
  const content = fs.readFileSync(envPath, "utf-8")
  const lines = content.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=")
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join("=")
      }
    }
  }
}
```

### Anti-Patterns to Avoid
- **No pagination:** Will silently truncate data at 1000 rows
- **No verification metadata:** Cannot confirm export completeness without re-querying
- **Storing in .gitignore'd folder:** Loses audit trail, backup purpose defeated
- **Hardcoding credentials:** Use .env.local pattern like other scripts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting | Manual ISO string | date-fns `format()` | Already in project, handles edge cases |
| Supabase auth | New client pattern | `createAdminClient()` | Existing pattern in lib/supabase/admin.ts |
| Env loading | dotenv package | Existing loadEnv() | Pattern from scripts/add-test-repreneur.ts |

**Key insight:** This project has established patterns for scripts - copy them rather than inventing new ones.

## Common Pitfalls

### Pitfall 1: Supabase 1000-Row Limit
**What goes wrong:** Export only captures first 1000 rows, data appears complete but isn't.
**Why it happens:** Supabase default limit not obvious, no error returned.
**How to avoid:** Always use pagination with .range(), verify counts match.
**Warning signs:** Export count doesn't match database count.

### Pitfall 2: Missing Related Data
**What goes wrong:** Export repreneurs but forget notes, offers, activities.
**Why it happens:** Tables have foreign keys but export only queries one table.
**How to avoid:** Export all related tables, document dependencies.
**Warning signs:** Import/analysis later fails on missing relationships.

### Pitfall 3: JSON Date Serialization
**What goes wrong:** Dates become strings, lose timezone info on re-import.
**Why it happens:** JSON.stringify converts Date objects to ISO strings.
**How to avoid:** Store as ISO strings (Supabase already does this), document format.
**Warning signs:** Date comparisons fail after import.

### Pitfall 4: File Encoding Issues
**What goes wrong:** French accented characters corrupted.
**Why it happens:** Default encoding not UTF-8.
**How to avoid:** Explicitly specify `{ encoding: 'utf-8' }` in fs.writeFile.
**Warning signs:** Names like "Bertrand" become garbled.

### Pitfall 5: Export File Not in Git
**What goes wrong:** Export runs successfully but file not tracked.
**Why it happens:** Output folder not created, or in .gitignore.
**How to avoid:** Create data/exports/ with .gitkeep, verify not in .gitignore.
**Warning signs:** File exists locally but not after clone.

## Code Examples

### Complete Export Script Structure
```typescript
// scripts/export-database.ts
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Load environment (existing pattern)
function loadEnv() { /* ... */ }

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchAllRows<T>(table: string): Promise<T[]> {
  // Pagination logic here
}

async function exportDatabase() {
  console.log("Starting database export...")

  // Fetch all tables
  const [repreneurs, offers, repreneurOffers, notes, activities] = await Promise.all([
    fetchAllRows<Repreneur>("repreneurs"),
    fetchAllRows<Offer>("offers"),
    fetchAllRows<RepreneurOffer>("repreneur_offers"),
    fetchAllRows<Note>("notes"),
    fetchAllRows<Activity>("activities"),
  ])

  // Build export with metadata
  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0.0",
      tables: {
        repreneurs: { count: repreneurs.length },
        offers: { count: offers.length },
        repreneur_offers: { count: repreneurOffers.length },
        notes: { count: notes.length },
        activities: { count: activities.length },
      },
      totalRecords: repreneurs.length + offers.length +
                    repreneurOffers.length + notes.length + activities.length,
    },
    data: { repreneurs, offers, repreneurOffers, notes, activities }
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `export-${timestamp}.json`
  const exportPath = path.join(process.cwd(), "data", "exports", filename)

  // Ensure directory exists
  fs.mkdirSync(path.dirname(exportPath), { recursive: true })

  // Write file
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), { encoding: "utf-8" })

  console.log(`Export complete: ${filename}`)
  console.log(`Total records: ${exportData.metadata.totalRecords}`)
  console.log("Record counts by table:")
  Object.entries(exportData.metadata.tables).forEach(([table, info]) => {
    console.log(`  - ${table}: ${info.count}`)
  })

  return { filename, metadata: exportData.metadata }
}

exportDatabase()
  .then(({ filename, metadata }) => {
    console.log("\nVerification:")
    console.log(`File created: data/exports/${filename}`)
    console.log("Run 'git add data/exports/' to stage for commit")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Export failed:", err)
    process.exit(1)
  })
```

### Verification Script
```typescript
// scripts/verify-export.ts
import * as fs from "fs"
import * as path from "path"

const exportFile = process.argv[2]
if (!exportFile) {
  console.error("Usage: npx tsx scripts/verify-export.ts <export-file.json>")
  process.exit(1)
}

const exportPath = path.join(process.cwd(), "data", "exports", exportFile)
const content = fs.readFileSync(exportPath, { encoding: "utf-8" })
const exportData = JSON.parse(content)

console.log("Export Verification Report")
console.log("==========================")
console.log(`Exported at: ${exportData.metadata.exportedAt}`)
console.log(`Total records: ${exportData.metadata.totalRecords}`)
console.log("\nTable counts:")
Object.entries(exportData.metadata.tables).forEach(([table, info]) => {
  const actualCount = exportData.data[table === "repreneur_offers" ? "repreneurOffers" : table]?.length ?? 0
  const match = actualCount === (info as { count: number }).count ? "OK" : "MISMATCH"
  console.log(`  ${table}: ${(info as { count: number }).count} (${match})`)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single query all | Paginated fetch | Always for Supabase | Prevents silent truncation |
| CSV export | JSON export | N/A | Better for nested data structures |
| External backup service | Git-tracked exports | N/A | Simpler audit trail |

**Deprecated/outdated:**
- Supabase JS v1 syntax (now v2) - project already on v2

## Format Decision: JSON vs CSV

The requirement DATA-01 mentions "CSV" but the success criteria mentions "JSON export":

| Factor | JSON | CSV |
|--------|------|-----|
| Nested arrays (sector_preferences, target_location) | Native support | Requires flattening |
| Record verification | Easy - just count array length | Requires parsing all rows |
| Human readability | Formatted with indent | Better for spreadsheets |
| Re-import capability | Direct | Requires mapping |

**Recommendation:** Use JSON. The data model has array fields (sector_preferences, target_location, etc.) that would require awkward flattening in CSV. JSON preserves structure exactly.

## Open Questions

1. **Where exactly should exports live?**
   - Recommendation: `data/exports/` - simple, clear purpose
   - Alternative: `scripts/data-quality/exports/` to co-locate with existing data quality work
   - Decision needed before planning

2. **Should old exports be auto-deleted?**
   - Recommendation: No, keep all for audit trail (they're small)
   - Git history preserves everything anyway

3. **Include email tables?**
   - Project has email_logs, email_templates tables
   - Recommendation: Include for completeness (they're small)

## Sources

### Primary (HIGH confidence)
- [Supabase JavaScript Select Documentation](https://supabase.com/docs/reference/javascript/select) - Pagination, limits, .range() method
- Project codebase: `scripts/add-test-repreneur.ts` - Existing script patterns
- Project codebase: `lib/supabase/admin.ts` - Admin client pattern
- Project codebase: `lib/types/repreneur.ts`, `lib/types/offer.ts` - Data model types

### Secondary (MEDIUM confidence)
- [Supabase JavaScript API Reference](https://supabase.com/docs/reference/javascript/start) - General SDK usage
- [Node.js File System Documentation](https://nodejs.org/api/fs.html) - fs/promises API

### Tertiary (LOW confidence)
- WebSearch: General Node.js JSON export patterns - validated against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing project patterns
- Architecture: HIGH - simple script, proven patterns in codebase
- Pitfalls: HIGH - Supabase pagination limit verified in official docs

**Research date:** 2026-01-26
**Valid until:** 2026-03-26 (stable, no fast-moving dependencies)
