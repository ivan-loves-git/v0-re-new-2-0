import { NextResponse } from "next/server"
import { Resend } from "resend"
import { Pool } from "pg"

export async function GET() {
  const results: Record<string, unknown> = {}

  // Step 1: Test Resend
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: "Re-New <notifications@news.re-new.team>",
      to: "ivanpaudice@me.com",
      subject: "Test: password reset debug",
      html: "<p>If you see this, Resend works in production.</p>",
    })
    if (error) {
      results.resend = { ok: false, error }
    } else {
      results.resend = { ok: true, id: data?.id }
    }
  } catch (err: any) {
    results.resend = { ok: false, error: err.message }
  }

  // Step 2: Test DB - find user
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    })
    const user = await pool.query(
      'SELECT id, email, name FROM "user" WHERE email = $1',
      ["ivanpaudice@icloud.com"]
    )
    results.db_user = { ok: true, found: user.rows.length > 0 }

    // Step 3: Test verification table write
    const testId = "test_" + Date.now()
    await pool.query(
      `INSERT INTO "verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW() + interval '1 hour', NOW(), NOW())`,
      [testId, "test@test.com", "test_token"]
    )
    await pool.query('DELETE FROM "verification" WHERE id = $1', [testId])
    results.db_verification = { ok: true, write_works: true }

    await pool.end()
  } catch (err: any) {
    results.db = { ok: false, error: err.message }
  }

  return NextResponse.json(results)
}
