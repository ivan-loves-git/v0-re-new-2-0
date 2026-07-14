import { Suspense } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { CopyButton } from "../c/[slug]/copy-button"
import { connection } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"
import { sanitizePublicHtml } from "@/lib/security/sanitize-html"

export default function ScrapbookPage() {
  return (
    <Suspense fallback={null}>
      <ScrapbookContent />
    </Suspense>
  )
}

async function ScrapbookContent() {
  await connection()
  await requireStaffAccess()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("clipboard")
    .select("title, html_content, created_at")
    .eq("slug", "scrapbook")
    .single()

  if (error || !data) {
    return (
      <div
        style={{
          maxWidth: 800,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui, sans-serif",
          color: "#999",
          textAlign: "center",
        }}
      >
        <p>Nothing on the scrapbook yet.</p>
      </div>
    )
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href="/scrapbook/review"
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#2563eb",
              backgroundColor: "#eff6ff",
              border: "1px solid #2563eb",
              borderRadius: 6,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Review
          </a>
          <CopyButton html={safeHtml} />
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  )
}
