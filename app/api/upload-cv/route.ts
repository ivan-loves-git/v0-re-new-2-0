import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { updateRepreneurField } from "@/lib/actions/repreneurs"

// Allowed CV file types
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx"]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const repreneurId = formData.get("repreneurId") as string

    if (!file || !repreneurId) {
      return NextResponse.json({ error: "Missing file or repreneurId" }, { status: 400 })
    }

    // Validate file type
    const fileExt = file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_TYPES.includes(file.type) && (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt))) {
      return NextResponse.json({ error: "File must be a PDF or Word document" }, { status: 400 })
    }

    // Validate file size (max 10MB for documents)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 })
    }

    // Generate unique filename
    const fileName = `${repreneurId}-${Date.now()}.${fileExt}`
    const filePath = `cvs/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("cvs")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (error) {
      console.error("Storage upload error:", error)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("cvs")
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { repreneurId, cvUrl } = await request.json()

    if (!repreneurId || !cvUrl) {
      return NextResponse.json({ error: "Missing repreneurId or cvUrl" }, { status: 400 })
    }

    // Extract file path from URL
    const urlParts = cvUrl.split("/cvs/")
    if (urlParts.length < 2) {
      return NextResponse.json({ error: "Invalid CV URL" }, { status: 400 })
    }
    const filePath = `cvs/${urlParts[1]}`

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from("cvs")
      .remove([filePath])

    if (deleteError) {
      console.error("Storage delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
    }

    // Clear cv_url in database
    await updateRepreneurField(repreneurId, "cv_url", null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
