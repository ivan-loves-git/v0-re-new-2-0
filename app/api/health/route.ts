import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      RESEND_API_KEY: process.env.RESEND_API_KEY ? `set (${process.env.RESEND_API_KEY.slice(0, 6)}...)` : "NOT SET",
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "NOT SET",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? "set" : "NOT SET",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "NOT SET",
    },
  })
}
