import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "WAVE AI next-action suggestions have been removed. Use the opportunity actions instead." },
    { status: 410 },
  )
}
