import { createAdminClient } from "@/lib/supabase/admin"
import { DownloadButton, HtmlPreview } from "./scrapbook-html-download-button"

export const dynamic = "force-dynamic"

export async function ScrapbookHtmlPage({ slot }: { slot: number }) {
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
        maxWidth: 900,
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
