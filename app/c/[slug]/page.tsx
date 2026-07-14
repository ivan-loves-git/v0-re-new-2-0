import { Suspense } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { CopyButton } from "./copy-button"
import { sanitizePublicHtml } from "@/lib/security/sanitize-html"

export default function ClipboardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  return (
    <Suspense fallback={null}>
      <ClipboardContent params={params} />
    </Suspense>
  )
}

async function ClipboardContent({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await connection()

  const { slug } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("clipboard")
    .select("title, html_content")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    notFound()
  }

  const safeHtml = sanitizePublicHtml(data.html_content)

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#333", margin: 0 }}>
          {data.title}
        </h1>
        <CopyButton html={safeHtml} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  )
}
