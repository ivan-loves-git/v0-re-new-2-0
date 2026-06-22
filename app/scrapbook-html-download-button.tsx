"use client"

import { useEffect, useState } from "react"

// Renders stored HTML full-screen, edge-to-edge, as if the file were opened
// directly from disk. No download button, no title bar, no frame.
export function HtmlPreview({ html, title }: { html: string; title: string }) {
  const [srcDoc, setSrcDoc] = useState("")

  useEffect(() => {
    setSrcDoc(html)
  }, [html])

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      // allow-scripts is REQUIRED or no JS runs and every button/tab/pagination
      // in uploaded HTML is dead (works locally, breaks on the public URL).
      // allow-same-origin keeps localStorage/relative-fetch working so the page
      // behaves exactly like opening the file locally. Content is Ivan's own
      // trusted HTML (allowlisted slugs), so the sandbox-escape caveat is moot.
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: "none",
        backgroundColor: "#fff",
      }}
    />
  )
}
