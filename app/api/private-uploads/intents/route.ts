import { NextResponse } from "next/server"
import {
  createPrivateUploadIntent,
  IntakeUploadSecurityError,
  PrivateUploadError,
  readPrivateUploadJson,
} from "@/lib/private-upload-server"

export async function POST(request:Request) {
  try {
    const result=await createPrivateUploadIntent(request,await readPrivateUploadJson(request))
    return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}})
  } catch(error) {
    if (error instanceof PrivateUploadError || error instanceof IntakeUploadSecurityError) {
      return NextResponse.json({error:error.message},{status:error.status,headers:"retryAfter" in error && error.retryAfter?{"Retry-After":String(error.retryAfter)}:undefined})
    }
    console.error("W-165 upload intent failed",error)
    return NextResponse.json({error:"Upload authorization is temporarily unavailable."},{status:503})
  }
}
