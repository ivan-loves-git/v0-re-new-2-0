import { Suspense } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { DownloadButton, HtmlPreview } from "./scrapbook-html-download-button"
import { connection } from "next/server"


export function ScrapbookHtmlPage({ slot }: { slot: number }) {
  return (
    <Suspense fallback={<ScrapbookHtmlFallback />}>
      <ScrapbookHtmlContent slot={slot} />
    </Suspense>
  )
}

function ScrapbookHtmlFallback() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        padding: "16px 20px 20px",
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
        background: "#f8fafc",
      }}
    />
  )
}

async function ScrapbookHtmlContent({ slot }: { slot: number }) {
  await connection()

  const supabase = createAdminClient()
  const slug = `scrapbook-html-${slot}`

  const { data, error } = await supabase
    .from("clipboard")
    .select("title, html_content, created_at")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    return (
      <div
        style={{
          maxWidth: 900,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui, sans-serif",
          color: "#999",
          textAlign: "center",
        }}
      >
        <p>Slot {slot} is empty.</p>
      </div>
    )
  }

  const filename =
    data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || slug

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        padding: "16px 20px 20px",
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          padding: "10px 12px",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fff",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#333",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.title}
          </h1>
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Slot {slot} · updated {new Date(data.created_at).toLocaleString()}
          </div>
        </div>
        <DownloadButton html={data.html_content} filename={`${filename}.html`} />
      </div>
      <HtmlPreview html={data.html_content} title={data.title || slug} />
    </div>
  )
}
