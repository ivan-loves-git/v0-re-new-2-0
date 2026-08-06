import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error: "Direct sending from the retired Wavy endpoint is disabled. Review and copy the WAVE AI draft instead.",
    },
    { status: 410 },
  )
}
