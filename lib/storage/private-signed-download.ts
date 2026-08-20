import { NextResponse } from "next/server"
import { env } from "@/lib/env"

const MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/octet-stream",
] as const

export type PrivateSignedDownloadContentType = (typeof MIME_TYPES)[number]

export interface ProxyPrivateSignedDownloadOptions {
  contentType: PrivateSignedDownloadContentType
  filename: string
  disposition?: "attachment" | "inline"
}

function safeAttachmentFilename(filename: string) {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120)

  return sanitized || "download"
}

export function privateSignedDownloadContentType(
  value: string | null | undefined,
): PrivateSignedDownloadContentType {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase()
  return MIME_TYPES.includes(normalized as PrivateSignedDownloadContentType)
    ? normalized as PrivateSignedDownloadContentType
    : "application/octet-stream"
}

export function privateStorageDownloadError(message: string) {
  return NextResponse.json(
    { error: message },
    {
      status: 502,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

function isExpectedSignedStorageUrl(value: string) {
  try {
    const signedUrl = new URL(value)
    const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
    return (
      signedUrl.origin === supabaseUrl.origin &&
      signedUrl.pathname.startsWith("/storage/v1/object/sign/")
    )
  } catch {
    return false
  }
}

/**
 * Streams an internally-created Storage capability through an already-
 * authorized route. The capability stays server-side and is therefore not
 * reusable after route-level authorization changes.
 */
export async function proxyPrivateSignedStorageDownload(
  signedUrl: string,
  options: ProxyPrivateSignedDownloadOptions,
) {
  if (!isExpectedSignedStorageUrl(signedUrl)) return null

  let upstream: Response
  try {
    upstream = await fetch(signedUrl, { cache: "no-store", redirect: "error" })
  } catch {
    return null
  }

  if (!upstream.ok || !upstream.body) return null

  const upstreamContentType = upstream.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (
    upstreamContentType !== options.contentType &&
    upstreamContentType !== "application/octet-stream"
  ) {
    return null
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${options.disposition ?? "attachment"}; filename="${safeAttachmentFilename(options.filename)}"`,
      "Content-Type": options.contentType,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
