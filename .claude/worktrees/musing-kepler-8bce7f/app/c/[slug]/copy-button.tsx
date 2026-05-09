"use client"

import { useState } from "react"

export function CopyButton({ html }: { html: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const blob = new Blob([html], { type: "text/html" })
      const plainBlob = new Blob([html.replace(/<[^>]*>/g, "")], {
        type: "text/plain",
      })
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": plainBlob,
        }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.innerHTML = html
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 500,
        color: copied ? "#16a34a" : "#fff",
        backgroundColor: copied ? "#f0fdf4" : "#2563eb",
        border: copied ? "1px solid #16a34a" : "1px solid #2563eb",
        borderRadius: 6,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : "Copy to clipboard"}
    </button>
  )
}
