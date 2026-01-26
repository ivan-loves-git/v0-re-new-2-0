/**
 * Database Export Script
 * Creates a timestamped JSON snapshot of all tables for audit trail before cleanup.
 * Run with: npx tsx scripts/export-database.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Simple env loader (same pattern as add-test-repreneur.ts)
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

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables")
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Fetch all rows from a table with pagination to avoid Supabase's 1000-row limit
 */
async function fetchAllRows<T>(
  client: SupabaseClient,
  table: string,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1)
      .order("created_at", { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`)
    }

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

interface ExportMetadata {
  exportedAt: string
  exportVersion: string
  tables: {
    [tableName: string]: { count: number }
  }
  totalRecords: number
}

interface DatabaseExport {
  metadata: ExportMetadata
  data: {
    repreneurs: unknown[]
    offers: unknown[]
    repreneur_offers: unknown[]
    notes: unknown[]
    activities: unknown[]
  }
}

async function exportDatabase() {
  console.log("Starting database export...")
  console.log("")

  // Fetch all tables in parallel
  const [repreneurs, offers, repreneurOffers, notes, activities] = await Promise.all([
    fetchAllRows(supabase, "repreneurs"),
    fetchAllRows(supabase, "offers"),
    fetchAllRows(supabase, "repreneur_offers"),
    fetchAllRows(supabase, "notes"),
    fetchAllRows(supabase, "activities"),
  ])

  // Build export with metadata
  const exportData: DatabaseExport = {
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
      totalRecords:
        repreneurs.length +
        offers.length +
        repreneurOffers.length +
        notes.length +
        activities.length,
    },
    data: {
      repreneurs,
      offers,
      repreneur_offers: repreneurOffers,
      notes,
      activities,
    },
  }

  // Generate filename with timestamp (safe for filenames)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `export-${timestamp}.json`
  const exportPath = path.join(process.cwd(), "data", "exports", filename)

  // Ensure directory exists
  fs.mkdirSync(path.dirname(exportPath), { recursive: true })

  // Write file with UTF-8 encoding
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), {
    encoding: "utf-8",
  })

  // Print summary
  console.log("Export complete!")
  console.log("")
  console.log(`File: data/exports/${filename}`)
  console.log(`Total records: ${exportData.metadata.totalRecords}`)
  console.log("")
  console.log("Record counts by table:")
  Object.entries(exportData.metadata.tables).forEach(([table, info]) => {
    console.log(`  - ${table}: ${info.count}`)
  })
  console.log("")
  console.log("Next steps:")
  console.log("  git add data/exports/")
  console.log("  git commit -m 'chore(02-01): export database snapshot before cleanup'")

  return { filename, metadata: exportData.metadata }
}

exportDatabase()
  .then(({ filename }) => {
    console.log("")
    console.log(`✓ Export saved to: data/exports/${filename}`)
    process.exit(0)
  })
  .catch((err) => {
    console.error("Export failed:", err)
    process.exit(1)
  })
