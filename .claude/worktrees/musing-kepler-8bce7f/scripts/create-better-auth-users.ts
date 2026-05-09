/**
 * Script to create users in Better Auth
 * Run with: npx tsx scripts/create-better-auth-users.ts
 *
 * Usage: Set PASSWORD env var or pass as argument
 *   PASSWORD=MySecurePass123 npx tsx scripts/create-better-auth-users.ts
 */

const USERS = [
  { email: "bertrand.galas@edu.escp.eu", name: "Bertrand" },
  { email: "amelie.lyon@edu.escp.eu", name: "Amélie" },
  { email: "antoine.duchene@edu.escp.eu", name: "Antoine" },
  { email: "alexandre.devulder@sony.com", name: "Alexandre" },
  { email: "Gabriele.Betti@outlook.com", name: "Gabriele" },
  { email: "ignacio.campos@edu.escp.eu", name: "Ignacio" },
  { email: "ivanpaudice@icloud.com", name: "Ivan" },
  { email: "piera.gallo@edu.escp.eu", name: "Piera" },
  { email: "renew@icpteam.eu", name: "ICP Team" },
]

async function createUsers() {
  const password = process.env.PASSWORD || process.argv[2]

  if (!password) {
    console.error("Error: No password provided.")
    console.error("Usage: PASSWORD=YourPassword npx tsx scripts/create-better-auth-users.ts")
    console.error("   or: npx tsx scripts/create-better-auth-users.ts YourPassword")
    process.exit(1)
  }

  console.log("Creating users in Better Auth via API...\n")
  console.log("Note: Make sure the app is running locally (npm run dev)\n")

  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

  for (const user of USERS) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": baseUrl,
        },
        body: JSON.stringify({
          email: user.email,
          password,
          name: user.name,
        }),
      })

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))

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

  console.log("\nDone!")
}

createUsers().catch(console.error)
