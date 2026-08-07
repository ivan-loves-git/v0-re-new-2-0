"use client"

import { useState, useRef } from "react"
import {
  FileText,
  FolderOpen,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentRowActions, type DocumentRowPolicy } from "@/components/opportunities/document-row-actions"
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

const CV_LDC_DOCUMENT_POLICY: DocumentRowPolicy = {
  canUpload: true,
  canView: true,
  canDownload: true,
  canReplace: true,
  canRemove: true,
  canChangeVisibility: false,
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
      console.error("Document upload failed")
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
      console.error("Document deletion failed")
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

      <DocumentRowActions
        policy={CV_LDC_DOCUMENT_POLICY}
        state={isUploading || isDeleting ? "pending" : "available"}
        viewHref={currentUrl ? documentUrl : undefined}
        downloadHref={currentUrl ? `${documentUrl}?download` : undefined}
        onUpload={!currentUrl ? () => fileInputRef.current?.click() : undefined}
        onReplace={currentUrl ? () => fileInputRef.current?.click() : undefined}
        onRemove={currentUrl ? handleDelete : undefined}
      />
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
