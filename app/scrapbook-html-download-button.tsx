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
      // Scripts remain available for interactive reports, but the document is
      // deliberately kept on an opaque origin so stored HTML cannot read the
      // WAVE session, cookies, or parent document.
      sandbox="allow-scripts allow-popups allow-forms allow-modals"
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
