import { afterEach, describe, expect, it, vi } from "vitest"
import {
  privateSignedDownloadContentTypeFromFilename,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"

const SIGNED_URL = "https://supabase.test.invalid/storage/v1/object/sign/private-bucket/file.pdf?token=opaque"

afterEach(() => vi.unstubAllGlobals())

describe("private signed download proxy", () => {
  it("streams a valid signed object without exposing its capability", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("pdf-bytes", {
      headers: { "content-type": "application/pdf" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const response = await proxyPrivateSignedStorageDownload(SIGNED_URL, {
      filename: "Investor memo.pdf",
      contentType: "application/pdf",
    })

    expect(fetchMock).toHaveBeenCalledWith(SIGNED_URL, { cache: "no-store", redirect: "error" })
    expect(response?.status).toBe(200)
    expect(response?.headers.get("location")).toBeNull()
    expect(response?.headers.get("content-disposition")).toBe('attachment; filename="Investor-memo.pdf"')
    expect(response?.headers.get("cache-control")).toBe("private, no-store")
    expect(await response?.text()).toBe("pdf-bytes")
  })

  it("rejects an arbitrary URL rather than turning the route into an SSRF proxy", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const response = await proxyPrivateSignedStorageDownload("https://169.254.169.254/latest/meta-data", {
      filename: "metadata.txt",
      contentType: "application/octet-stream",
    })

    expect(response).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects active HTML returned for an expected private PDF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad</html>", {
      headers: { "content-type": "text/html" },
    })))

    const response = await proxyPrivateSignedStorageDownload(SIGNED_URL, {
      filename: "memo.pdf",
      contentType: "application/pdf",
    })

    expect(response).toBeNull()
  })

  it("forces an unknown generic staff document to a safe attachment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("plain bytes", {
      headers: { "content-type": "text/plain" },
    })))

    const response = await proxyPrivateSignedStorageDownload(SIGNED_URL, {
      filename: null,
      contentType: "application/octet-stream",
    })

    expect(response?.status).toBe(200)
    expect(response?.headers.get("content-type")).toBe("application/octet-stream")
    expect(response?.headers.get("content-disposition")).toBe(
      'attachment; filename="download"',
    )
  })

  it("still rejects active HTML when generic metadata falls back to octet-stream", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad</html>", {
      headers: { "content-type": "text/html" },
    })))

    const response = await proxyPrivateSignedStorageDownload(SIGNED_URL, {
      filename: "legacy-file",
      contentType: "application/octet-stream",
    })

    expect(response).toBeNull()
  })

  it("derives the three supported repreneur document types from the stored filename", () => {
    expect(privateSignedDownloadContentTypeFromFilename("cv.pdf")).toBe("application/pdf")
    expect(privateSignedDownloadContentTypeFromFilename("cv.doc")).toBe("application/msword")
    expect(privateSignedDownloadContentTypeFromFilename("cv.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
  })

  it("preserves a permitted External Pursuit spreadsheet as an attachment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("xlsx-bytes", {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    })))

    const response = await proxyPrivateSignedStorageDownload(SIGNED_URL, {
      filename: "Target list.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    expect(response?.status).toBe(200)
    expect(response?.headers.get("content-disposition")).toBe('attachment; filename="Target-list.xlsx"')
  })
})
