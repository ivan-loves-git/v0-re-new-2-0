import { createAdminClient } from "@/lib/supabase/admin"
import { CopyButton } from "../c/[slug]/copy-button"

export const dynamic = "force-dynamic"

export default async function ScrapbookPage() {
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
        <CopyButton html={data.html_content} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: data.html_content }} />
    </div>
  )
}
