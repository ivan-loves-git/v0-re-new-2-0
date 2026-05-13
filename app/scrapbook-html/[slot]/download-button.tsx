"use client"

export function DownloadButton({
  html,
  filename,
}: {
  html: string
  filename: string
}) {
  function handleDownload() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 200)
  }

  return (
    <button
      onClick={handleDownload}
      style={{
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 500,
        color: "#2563eb",
        backgroundColor: "#eff6ff",
        border: "1px solid #2563eb",
        borderRadius: 6,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      Download .html
    </button>
  )
}
