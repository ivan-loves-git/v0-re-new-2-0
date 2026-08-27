import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { cleanupExpiredPrivateUploads } from "@/lib/private-upload-server"

export const maxDuration=60

export async function GET(request:Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization")!==`Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({error:"Unauthorized"},{status:401})
  }
  try {
    return NextResponse.json(await cleanupExpiredPrivateUploads())
  } catch(error) {
    console.error("W-165 expired upload cleanup failed",error)
    return NextResponse.json({error:"Cleanup failed"},{status:500})
  }
}
