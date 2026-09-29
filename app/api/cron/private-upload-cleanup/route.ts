import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { cleanupExpiredPrivateUploads } from "@/lib/private-upload-server"
import { processRecipientImCleanup } from "@/lib/recipient-im-cleanup"

export const maxDuration=60

export async function GET(request:Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization")!==`Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({error:"Unauthorized"},{status:401})
  }
  try {
    const uploads = await cleanupExpiredPrivateUploads()
    const recipientIm = await processRecipientImCleanup()
    return NextResponse.json({ uploads, recipientIm })
  } catch(error) {
    console.error("W-165 expired upload cleanup failed",error)
    return NextResponse.json({error:"Cleanup failed"},{status:500})
  }
}
