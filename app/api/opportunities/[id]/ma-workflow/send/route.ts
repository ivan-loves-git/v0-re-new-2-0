import { NextResponse } from "next/server"
// Retired included direct-send entry point. The generic Manual Send tool is
// separate and unchanged; this route may never bypass staff review.
export async function POST() {
  return NextResponse.json({ success: false, message: "Prepare this email in Emails > Review & send." }, { status: 410 })
}
