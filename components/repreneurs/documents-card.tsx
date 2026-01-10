"use client"

import { useState, useRef } from "react"
import { FileText, Upload, Trash2, Loader2, ExternalLink, FolderOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { updateRepreneurField } from "@/lib/actions/repreneurs"

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

      const response = await fetch("/api/upload-cv", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Upload failed")
      }

      const { url: newUrl } = await response.json()
      await updateRepreneurField(repreneurId, field, newUrl)
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
        body: JSON.stringify({ repreneurId, cvUrl: currentUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Delete failed")
      }

      await updateRepreneurField(repreneurId, field, null)
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
        <FileText className="h-5 w-5 text-gray-400" />
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-gray-500">
            {currentUrl ? "PDF uploaded" : "No file uploaded"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {currentUrl ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => window.open(currentUrl, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-500 hover:border-red-200"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
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
          <FolderOpen className="h-5 w-5" />
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
