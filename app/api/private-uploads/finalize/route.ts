import { NextResponse } from "next/server"
import { finalizePrivateUpload,PrivateUploadError,readPrivateUploadJson } from "@/lib/private-upload-server"

export const maxDuration=60

export async function POST(request:Request) {
  try {
    return NextResponse.json(await finalizePrivateUpload(request,await readPrivateUploadJson(request)),{headers:{"Cache-Control":"no-store"}})
  } catch(error) {
    if (error instanceof PrivateUploadError) return NextResponse.json({error:error.message},{status:error.status})
    console.error("W-165 upload finalization failed",error)
    return NextResponse.json({error:"The uploaded file could not be finalized."},{status:500})
  }
}
