/**
 * Script to create users in Better Auth
 * Run with: npx tsx scripts/create-better-auth-users.ts
 *
 * This creates the same users that existed in Supabase Auth
 */

import { Pool } from "pg"
import { randomUUID } from "crypto"

// Load environment variables
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const USERS = [
  {
    email: "bertrand.galas@edu.escp.eu",
    password: "Wave2025!",
    name: "Bertrand",
  },
  {
    email: "amelie.lyon@edu.escp.eu",
    password: "Wave2025!",
    name: "Amélie",
  },
  {
    email: "antoine.duchene@edu.escp.eu",
    password: "Wave2025!",
    name: "Antoine",
  },
  {
    email: "renew@icpteam.eu",
    password: "Wave2025!",
    name: "ICP Team",
  },
]

// Simple password hashing (Better Auth uses bcrypt-compatible hashing)
async function hashPassword(password: string): Promise<string> {
  // Better Auth expects bcrypt format, we'll use the built-in API endpoint instead
  // For now, let's create users via the API
  return password
}

async function createUsers() {
  console.log("Creating users in Better Auth via API...\n")
  console.log("Note: Make sure the app is running locally (npm run dev)\n")

  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

  for (const user of USERS) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        console.log(`✓ Created user: ${user.email} (${user.name})`)
      } else if (result.message?.includes("already") || result.code === "USER_ALREADY_EXISTS") {
        console.log(`- User already exists: ${user.email}`)
      } else {
        console.error(`✗ Failed to create user ${user.email}:`, result.message || result)
      }
    } catch (error: any) {
      console.error(`✗ Failed to create user ${user.email}:`, error.message || error)
    }
  }

  console.log("\nDone! Users can now log in with password: Wave2025!")
  console.log("\nQuick access buttons on login page:")
  USERS.forEach((u) => {
    console.log(`  - ${u.name}: ${u.email}`)
  })
}

createUsers().catch(console.error)
