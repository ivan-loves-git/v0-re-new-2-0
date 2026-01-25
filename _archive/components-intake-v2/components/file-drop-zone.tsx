"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, X, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface FileDropZoneProps {
  file: File | null
  onFileChange: (file: File | null) => void
  accept?: string
  maxSizeMB?: number
  title: string
  description: string
  isUploading?: boolean
  uploadProgress?: number
  variant?: "default" | "amber"
  className?: string
}

/**
 * Drag & drop file upload zone with preview and progress
 */
export function FileDropZone({
  file,
  onFileChange,
  accept = ".pdf,application/pdf",
  maxSizeMB = 10,
  title,
  description,
  isUploading = false,
  uploadProgress = 0,
  variant = "default",
  className,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (f: File): boolean => {
      setError(null)

      // Check file type
      const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase())
      const fileType = f.type.toLowerCase()
      const fileExtension = `.${f.name.split(".").pop()?.toLowerCase()}`

      const isValidType = acceptedTypes.some(
        (type) =>
          fileType === type ||
          fileExtension === type ||
          (type.includes("*") && fileType.startsWith(type.replace("*", "")))
      )

      if (!isValidType) {
        setError("Please upload a PDF file")
        return false
      }

      // Check file size
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`File size must be less than ${maxSizeMB}MB`)
        return false
      }

      return true
    },
    [accept, maxSizeMB]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile && validateFile(droppedFile)) {
        onFileChange(droppedFile)
      }
    },
    [validateFile, onFileChange]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile && validateFile(selectedFile)) {
        onFileChange(selectedFile)
      }
    },
    [validateFile, onFileChange]
  )

  const handleRemove = useCallback(() => {
    onFileChange(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [onFileChange])

  const colors = {
    default: {
      bg: "bg-gray-50/80",
      border: "border-gray-200",
      borderHover: "hover:border-blue-300",
      borderActive: "border-blue-400 bg-blue-50/50",
      icon: "bg-blue-100 text-blue-600",
      button: "hover:border-blue-400 hover:bg-blue-50",
    },
    amber: {
      bg: "bg-amber-50/80",
      border: "border-amber-200",
      borderHover: "hover:border-amber-300",
      borderActive: "border-amber-400 bg-amber-50/50",
      icon: "bg-amber-100 text-amber-600",
      button: "hover:border-amber-400 hover:bg-amber-100",
    },
  }

  const c = colors[variant]

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {file ? (
          // File preview
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl border-2 backdrop-blur-sm",
              c.bg,
              c.border
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", c.icon)}>
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm truncate max-w-[200px] sm:max-w-none">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                    {isUploading && uploadProgress > 0 && ` - ${uploadProgress}%`}
                  </p>
                </div>
              </div>

              {!isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Upload progress bar */}
            {isUploading && (
              <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        ) : (
          // Drop zone
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-6 rounded-2xl border-2 border-dashed backdrop-blur-sm transition-all duration-200 cursor-pointer",
              c.bg,
              isDragOver ? c.borderActive : [c.border, c.borderHover]
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className={cn("w-12 h-12 rounded-xl flex items-center justify-center", c.icon)}
                animate={{
                  scale: isDragOver ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Upload className="w-6 h-6" />
              </motion.div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className={cn("w-full h-11", c.button)}
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File or Drag & Drop
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-2 text-sm text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
