import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase/server"

// Security: Whitelist of allowed image extensions
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]

// Magic bytes to verify actual file content matches claimed type
const MAGIC_BYTES: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
  gif: [0x47, 0x49, 0x46], // GIF header
}

function verifyFileContent(bytes: Uint8Array, extension: string): boolean {
  const expectedBytes = MAGIC_BYTES[extension]
  if (!expectedBytes) return false
  return expectedBytes.every((b, i) => bytes[i] === b)
}

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

    // Security: Whitelist extension (don't trust Content-Type header)
    const fileExt = file.name.split(".").pop()?.toLowerCase()
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WebP and GIF images are allowed" },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Security: Verify file content matches claimed extension
    const headerBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (!verifyFileContent(headerBytes, fileExt)) {
      return NextResponse.json(
        { error: "File content does not match extension" },
        { status: 400 }
      )
    }

    // Generate unique filename with sanitized extension
    const fileName = `${repreneurId}-${Date.now()}.${fileExt}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (error) {
      console.error("Storage upload error:", error.message, error)
      return NextResponse.json({ error: `Failed to upload file: ${error.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName)

    // Update the repreneur's avatar_url in the database
    const { error: updateError } = await supabase
      .from("repreneurs")
      .update({ avatar_url: publicUrl })
      .eq("id", repreneurId)

    if (updateError) {
      console.error("Database update error:", updateError.message, updateError)
      return NextResponse.json({ error: `Failed to update avatar URL: ${updateError.message}` }, { status: 500 })
    }

    // Revalidate all pages that display repreneur data
    revalidatePath("/repreneurs")
    revalidatePath(`/repreneurs/${repreneurId}`)
    revalidatePath("/pipeline")

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
