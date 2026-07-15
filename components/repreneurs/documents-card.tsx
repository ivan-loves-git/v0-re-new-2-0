"use client"

import { useState, useRef } from "react"
import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface DocumentsCardProps {
  repreneurId: string
  cvUrl: string | null | undefined
  ldcUrl: string | null | undefined
}

interface DocumentRowProps {
  repreneurId: string
  label: string
  field: "cv_url" | "ldc_url"
  url: string | null | undefined
}

function DocumentRow({ repreneurId, label, field, url }: DocumentRowProps) {
  const [currentUrl, setCurrentUrl] = useState(url)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentType = field === "ldc_url" ? "ldc" : "cv"
  const documentUrl = `/api/repreneurs/${encodeURIComponent(repreneurId)}/documents/${documentType}`

  const handleUpload = async (file: File) => {
    // Validate file type (PDF only)
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("repreneurId", repreneurId)
      formData.append("documentType", documentType)

      const response = await fetch("/api/upload-cv", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Upload failed")
      }

      const { path } = await response.json()
      const newUrl = path || null
      setCurrentUrl(newUrl)
      toast.success(`${label} uploaded successfully`)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async () => {
    if (!currentUrl) return

    setIsDeleting(true)
    try {
      const response = await fetch("/api/upload-cv", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repreneurId,
          cvUrl: currentUrl,
          documentType,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Delete failed")
      }

      setCurrentUrl(null)
      toast.success(`${label} deleted`)
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
        }}
      />

      <div className="flex items-center gap-3">
        <FileText className="size-5 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">
            {currentUrl ? "PDF uploaded" : "No file uploaded"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {currentUrl ? (
          <>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <a href={documentUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                <span className="hidden sm:inline">View</span>
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <a href={`${documentUrl}?download`}>
                <Download className="size-3.5" />
                <span className="hidden md:inline">Download</span>
              </a>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label={`Replace ${label}`}
              title={`Replace ${label}`}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 text-muted-foreground hover:text-red-500 hover:border-red-200"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={`Delete ${label}`}
              title={`Delete ${label}`}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            <span>Upload</span>
          </Button>
        )}
      </div>
    </div>
  )
}

export function DocumentsCard({ repreneurId, cvUrl, ldcUrl }: DocumentsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-5" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <DocumentRow
          repreneurId={repreneurId}
          label="CV"
          field="cv_url"
          url={cvUrl}
        />
        <DocumentRow
          repreneurId={repreneurId}
          label="Lettre de Cadrage"
          field="ldc_url"
          url={ldcUrl}
        />
      </CardContent>
    </Card>
  )
}
