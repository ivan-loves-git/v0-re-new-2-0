"use client"

import { useState, useEffect } from "react"
import { CopyButton } from "../../c/[slug]/copy-button"

export default function ReviewPage() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saved, setSaved] = useState(false)
  const [savedHtml, setSavedHtml] = useState("")
  const [savedTitle, setSavedTitle] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/scrapbook/review-read")
      .then((r) => r.json())
      .then((data) => {
        if (data.html_content) {
          setSavedHtml(data.html_content)
          setSavedTitle(data.title || "Review")
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    const res = await fetch("/api/scrapbook/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "Review", content }),
    })

    if (res.ok) {
      const htmlContent = content
        .split("\n\n")
        .filter((p) => p.trim())
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("\n")
      setSavedHtml(htmlContent)
      setSavedTitle(title || "Review")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/scrapbook"
            style={{
              fontSize: 14,
              color: "#2563eb",
              textDecoration: "none",
            }}
          >
            &larr; Scrapbook
          </a>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#333",
              margin: 0,
            }}
          >
            Review
          </h1>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "system-ui, sans-serif",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            marginBottom: 12,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <textarea
          placeholder="Paste your content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            width: "100%",
            minHeight: 200,
            padding: "12px",
            fontSize: 14,
            fontFamily: "system-ui, sans-serif",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            resize: "vertical",
            boxSizing: "border-box",
            outline: "none",
            lineHeight: 1.6,
          }}
        />
        <button
          onClick={handleSave}
          disabled={!content.trim()}
          style={{
            marginTop: 12,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 500,
            color: saved ? "#16a34a" : "#fff",
            backgroundColor: saved
              ? "#f0fdf4"
              : !content.trim()
                ? "#93c5fd"
                : "#2563eb",
            border: saved ? "1px solid #16a34a" : "1px solid transparent",
            borderRadius: 6,
            cursor: content.trim() ? "pointer" : "default",
            transition: "all 0.15s",
          }}
        >
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      {!loading && savedHtml && (
        <div
          style={{
            paddingTop: 24,
            borderTop: "1px solid #e5e5e5",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#666",
                margin: 0,
              }}
            >
              {savedTitle}
            </h2>
            <CopyButton html={savedHtml} />
          </div>
          <div dangerouslySetInnerHTML={{ __html: savedHtml }} />
        </div>
      )}
    </div>
  )
}
