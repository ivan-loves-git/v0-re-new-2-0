import { NextResponse } from "next/server"
import { abortPrivateUpload,PrivateUploadError,readPrivateUploadJson } from "@/lib/private-upload-server"

export async function POST(request:Request) {
  try {
    return NextResponse.json(await abortPrivateUpload(request,await readPrivateUploadJson(request)),{headers:{"Cache-Control":"no-store"}})
  } catch(error) {
    if (error instanceof PrivateUploadError) return NextResponse.json({error:error.message},{status:error.status})
    console.error("W-165 upload abort failed",error)
    return NextResponse.json({error:"Upload cleanup was not confirmed."},{status:500})
  }
}
