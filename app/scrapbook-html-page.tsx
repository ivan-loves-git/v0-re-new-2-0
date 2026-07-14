import { Suspense } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { HtmlPreview } from "./scrapbook-html-download-button"
import { connection } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"

export function ScrapbookHtmlPage({ slot }: { slot: number }) {
  return (
    <Suspense fallback={<ScrapbookHtmlFallback />}>
      <ScrapbookHtmlContent slot={slot} />
    </Suspense>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, margin: 0, background: "#fff" }}>
      {children}
    </div>
  )
}

function ScrapbookHtmlFallback() {
  return <FullScreen>{null}</FullScreen>
}

async function ScrapbookHtmlContent({ slot }: { slot: number }) {
  await connection()
  await requireStaffAccess()

  const supabase = createAdminClient()
  const slug = `scrapbook-html-${slot}`

  const { data, error } = await supabase
    .from("clipboard")
    .select("title, html_content, created_at")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    return (
      <FullScreen>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            fontFamily: "system-ui, sans-serif",
            color: "#999",
          }}
        >
          <p>Slot {slot} is empty.</p>
        </div>
      </FullScreen>
    )
  }

  return (
    <FullScreen>
      <HtmlPreview html={data.html_content} title={data.title || slug} />
    </FullScreen>
  )
}
