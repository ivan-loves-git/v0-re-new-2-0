/**
 * Create users directly in the database (bypasses rate limiting)
 * Run with: PASSWORD=YourPassword npx tsx scripts/create-users-direct.ts
 *
 * W-154 classification: retired bootstrap utility. It is not imported by the
 * application or release automation and must not be used for current access
 * provisioning; the staff portal-access workflow owns that operation.
 */

import { randomBytes } from "crypto"
import { Pool } from "pg"
import { hashPassword } from "better-auth/crypto"

const USERS = [
  { email: "alexandre.devulder@sony.com", name: "Alexandre" },
  { email: "Gabriele.Betti@outlook.com", name: "Gabriele" },
  { email: "ignacio.campos@edu.escp.eu", name: "Ignacio" },
  { email: "ivanpaudice@icloud.com", name: "Ivan" },
  { email: "piera.gallo@edu.escp.eu", name: "Piera" },
]

async function createUsers() {
  const password = process.env.PASSWORD || process.argv[2]

  if (!password) {
    console.error("Error: No password provided.")
    console.error("Usage: PASSWORD=YourPassword npx tsx scripts/create-users-direct.ts")
    console.error("   or: npx tsx scripts/create-users-direct.ts YourPassword")
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  console.log("Creating users directly in database...\n")

  for (const user of USERS) {
    try {
      // Check if user exists
      const existing = await pool.query(
        'SELECT id FROM "user" WHERE email = $1',
        [user.email]
      )

      if (existing.rows.length > 0) {
        console.log(`- Already exists: ${user.email}`)
        continue
      }

      // Create user
      const id = randomBytes(16).toString("hex")
      const hashedPassword = await hashPassword(password)

      await pool.query(
        `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [id, user.email, user.name]
      )

      // Create account for email/password login
      await pool.query(
        `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'credential', $4, NOW(), NOW())`,
        [randomBytes(16).toString("hex"), id, user.email, hashedPassword]
      )

      console.log(`✓ Created: ${user.email} (${user.name})`)
    } catch (error: any) {
      console.error(`✗ Failed: ${user.email} - ${error.message}`)
    }
  }

  await pool.end()
  console.log("\nDone!")
}

createUsers().catch(console.error)
