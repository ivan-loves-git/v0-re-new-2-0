import { describe, expect, it } from "vitest"
import {
  getRepreneurDocumentDownloadName,
  resolveRepreneurDocumentStoragePath,
} from "@/lib/repreneur-document-storage"

describe("repreneur document storage metadata", () => {
  it("keeps current bucket-relative object paths", () => {
    expect(resolveRepreneurDocumentStoragePath("cvs/fixture-cv-123.pdf")).toBe(
      "cvs/fixture-cv-123.pdf",
    )
  })

  it("removes the bucket segment from legacy public URLs", () => {
    expect(
      resolveRepreneurDocumentStoragePath(
        "https://project.supabase.co/storage/v1/object/public/cvs/cvs/fixture-cv-123.pdf",
      ),
    ).toBe("cvs/fixture-cv-123.pdf")
  })

  it("supports legacy root objects and encoded filenames", () => {
    expect(
      resolveRepreneurDocumentStoragePath(
        "https://project.supabase.co/storage/v1/object/public/cvs/legacy%20fixture.pdf",
      ),
    ).toBe("legacy fixture.pdf")
  })

  it("supports signed and authenticated Supabase object URLs", () => {
    expect(
      resolveRepreneurDocumentStoragePath(
        "https://project.supabase.co/storage/v1/object/sign/cvs/cvs/fixture.docx?token=safe-test-token",
      ),
    ).toBe("cvs/fixture.docx")
    expect(
      resolveRepreneurDocumentStoragePath(
        "https://project.supabase.co/storage/v1/object/authenticated/cvs/cvs/fixture.doc",
      ),
    ).toBe("cvs/fixture.doc")
  })

  it("rejects missing, app-relative, foreign-bucket, and unsafe metadata", () => {
    expect(resolveRepreneurDocumentStoragePath(null)).toBeNull()
    expect(
      resolveRepreneurDocumentStoragePath(
        "/api/repreneurs/fixture/documents/cv",
      ),
    ).toBeNull()
    expect(
      resolveRepreneurDocumentStoragePath(
        "https://project.supabase.co/storage/v1/object/public/avatars/cvs/fixture.pdf",
      ),
    ).toBeNull()
    expect(resolveRepreneurDocumentStoragePath("cvs/../fixture.pdf")).toBeNull()
    expect(resolveRepreneurDocumentStoragePath("cvs/%E0%A4%A.pdf")).toBeNull()
  })

  it("uses a stable staff-facing filename while preserving the extension", () => {
    expect(getRepreneurDocumentDownloadName("cv", "cvs/fixture-123.pdf")).toBe(
      "CV.pdf",
    )
    expect(
      getRepreneurDocumentDownloadName("ldc", "cvs/fixture-123.docx"),
    ).toBe("Lettre-de-cadrage.docx")
  })
})
