import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase/server"

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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Generate unique filename (no subdirectory - bucket is already "avatars")
    const fileExt = file.name.split(".").pop()
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
