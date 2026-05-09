/**
 * Quick script to add a test repreneur with verified email
 * Run with: npx tsx scripts/add-test-repreneur.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Simple env loader
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

async function addTestRepreneur() {
  const testRepreneur = {
    email: "myworkmail4@gmail.com",
    first_name: "Test",
    last_name: "EmailVerified",
    lifecycle_status: "lead",
    marketing_consent: true,
    consent_source: "manual",
  }

  console.log("Adding test repreneur:", testRepreneur.email)

  // Check if already exists
  const { data: existing } = await supabase
    .from("repreneurs")
    .select("id, email")
    .eq("email", testRepreneur.email)
    .single()

  if (existing) {
    console.log("Repreneur already exists:", existing.id)
    return existing
  }

  // Insert new repreneur
  const { data, error } = await supabase
    .from("repreneurs")
    .insert(testRepreneur)
    .select()
    .single()

  if (error) {
    console.error("Failed to add repreneur:", error.message)
    process.exit(1)
  }

  console.log("Successfully added repreneur:", data.id)
  return data
}

addTestRepreneur()
  .then(() => {
    console.log("Done!")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Error:", err)
    process.exit(1)
  })
