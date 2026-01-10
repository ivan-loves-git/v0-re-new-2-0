"use client"

import { useState, useRef } from "react"
import { FileText, Upload, Trash2, Download, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { updateRepreneurField } from "@/lib/actions/repreneurs"

interface CVSectionProps {
  repreneurId: string
  cvUrl: string | null | undefined
}

export function CVSection({ repreneurId, cvUrl }: CVSectionProps) {
  const [currentCvUrl, setCurrentCvUrl] = useState(cvUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    const allowedExtensions = ["pdf", "doc", "docx"]
    const ext = file.name.split(".").pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && (!ext || !allowedExtensions.includes(ext))) {
      toast.error("File must be a PDF or Word document")
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

      const { url } = await response.json()
      await updateRepreneurField(repreneurId, "cv_url", url)
      setCurrentCvUrl(url)
      toast.success("CV uploaded successfully")
    } catch (error) {
      console.error("CV upload error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload CV")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async () => {
    if (!currentCvUrl) return

    setIsDeleting(true)
    try {
      const response = await fetch("/api/upload-cv", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repreneurId, cvUrl: currentCvUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Delete failed")
      }

      setCurrentCvUrl(null)
      toast.success("CV deleted")
    } catch (error) {
      console.error("CV delete error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete CV")
    } finally {
      setIsDeleting(false)
    }
  }

  // Extract filename from URL
  const getFileName = (url: string) => {
    const parts = url.split("/")
    const fullName = parts[parts.length - 1]
    // Remove timestamp and repreneur ID prefix (format: id-timestamp.ext)
    const nameParts = fullName.split("-")
    if (nameParts.length >= 2) {
      const ext = fullName.split(".").pop()
      return `CV.${ext}`
    }
    return fullName
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
        }}
      />

      {currentCvUrl ? (
        <>
          <Button
            variant="outline"
            className="h-10 gap-2 px-3"
            onClick={() => window.open(currentCvUrl, "_blank")}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">View CV</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 text-gray-400 hover:text-red-500 hover:border-red-200"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          className="h-10 gap-2 px-3"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>Upload CV</span>
        </Button>
      )}
    </div>
  )
}
