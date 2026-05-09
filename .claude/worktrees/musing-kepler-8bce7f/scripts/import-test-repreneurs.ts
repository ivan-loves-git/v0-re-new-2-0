import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importTestRepreneurs() {
  // Read the export file
  const exportPath = path.join(
    process.cwd(),
    "data/exports/export-2026-01-26T18-34-44-292Z.json"
  )
  const exportData = JSON.parse(fs.readFileSync(exportPath, "utf-8"))

  // Filter for test users (emails containing "test")
  const testRepreneurs = exportData.data.repreneurs.filter(
    (r: any) =>
      r.email.includes("test") &&
      !r.email.includes("placeholder.invalid") &&
      r.first_name // Has a name
  )

  console.log(`Found ${testRepreneurs.length} test repreneurs`)

  // Take first 15
  const toImport = testRepreneurs.slice(0, 15)

  console.log("\nRepreneurs to import:")
  toImport.forEach((r: any, i: number) => {
    console.log(`  ${i + 1}. ${r.first_name} ${r.last_name} (${r.email})`)
  })

  // Check for existing emails to avoid duplicates
  const emails = toImport.map((r: any) => r.email)
  const { data: existing } = await supabase
    .from("repreneurs")
    .select("email")
    .in("email", emails)

  const existingEmails = new Set(existing?.map((e: any) => e.email) || [])
  const newRepreneurs = toImport.filter(
    (r: any) => !existingEmails.has(r.email)
  )

  if (existingEmails.size > 0) {
    console.log(`\nSkipping ${existingEmails.size} existing repreneurs`)
  }

  if (newRepreneurs.length === 0) {
    console.log("\nNo new repreneurs to import (all already exist)")
    return
  }

  console.log(`\nInserting ${newRepreneurs.length} new repreneurs...`)

  // Remove id field (let Supabase generate new ones) and some fields that might cause issues
  const cleanedRepreneurs = newRepreneurs.map((r: any) => {
    const { id, created_by, flatchr_id, ...rest } = r
    return {
      ...rest,
      source: "test_import",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })

  // Insert in batches
  const batchSize = 5
  let inserted = 0

  for (let i = 0; i < cleanedRepreneurs.length; i += batchSize) {
    const batch = cleanedRepreneurs.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from("repreneurs")
      .insert(batch)
      .select("id, first_name, last_name, email")

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
    } else {
      inserted += data.length
      console.log(`  Inserted batch ${i / batchSize + 1}: ${data.length} records`)
    }
  }

  console.log(`\nDone! Inserted ${inserted} test repreneurs.`)
}

importTestRepreneurs().catch(console.error)
