"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Pencil, Upload, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { updateRepreneurField } from "@/lib/actions/repreneurs"

const TOTAL_DEFAULT_AVATARS = 16

// Generate a consistent avatar number from repreneur ID
function getDefaultAvatarNumber(repreneurId: string): number {
  // Use a simple hash of the ID to get a consistent number
  let hash = 0
  for (let i = 0; i < repreneurId.length; i++) {
    const char = repreneurId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash % TOTAL_DEFAULT_AVATARS) + 1
}

interface RepreneurAvatarProps {
  repreneurId: string
  avatarUrl?: string | null
  firstName?: string
  lastName?: string
  size?: "sm" | "md" | "lg" | "xl"
  editable?: boolean
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
}

const pencilSizeClasses = {
  sm: "h-4 w-4 -bottom-0.5 -right-0.5",
  md: "h-5 w-5 -bottom-0.5 -right-0.5",
  lg: "h-6 w-6 -bottom-1 -right-1",
  xl: "h-8 w-8 -bottom-1 -right-1",
}

export function RepreneurAvatar({
  repreneurId,
  avatarUrl,
  firstName,
  lastName,
  size = "md",
  editable = false,
  className,
}: RepreneurAvatarProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const defaultAvatarNumber = getDefaultAvatarNumber(repreneurId)
  const imageSrc = currentAvatarUrl || `/avatars/default-${defaultAvatarNumber}.png`
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      // Create form data for upload
      const formData = new FormData()
      formData.append("file", file)
      formData.append("repreneurId", repreneurId)

      // Upload to API route
      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const { url } = await response.json()

      // Update repreneur record
      await updateRepreneurField(repreneurId, "avatar_url", url)
      setCurrentAvatarUrl(url)
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Failed to upload avatar:", error)
      alert("Failed to upload avatar. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleResetToDefault = async () => {
    setIsUploading(true)
    try {
      // Clear custom avatar to use default
      await updateRepreneurField(repreneurId, "avatar_url", null)
      setCurrentAvatarUrl(null)
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Failed to reset avatar:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const avatarImage = (
    <div className={cn("relative rounded-full overflow-hidden bg-gray-200", sizeClasses[size], className)}>
      <Image
        src={imageSrc}
        alt={`${firstName} ${lastName}`}
        fill
        className="object-cover"
        sizes={size === "xl" ? "96px" : size === "lg" ? "64px" : size === "md" ? "40px" : "32px"}
      />
    </div>
  )

  if (!editable) {
    return avatarImage
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <button className="relative group cursor-pointer">
          {avatarImage}
          <div className={cn(
            "absolute bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center",
            "group-hover:bg-gray-100 transition-colors",
            pencilSizeClasses[size]
          )}>
            <Pencil className="h-3 w-3 text-gray-600" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Profile Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current avatar preview */}
          <div className="flex justify-center">
            <div className="relative h-32 w-32 rounded-full overflow-hidden bg-gray-200">
              <Image
                src={imageSrc}
                alt="Current avatar"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>

            {/* Reset to default button - only show if custom avatar is set */}
            {currentAvatarUrl && (
              <Button
                variant="outline"
                onClick={handleResetToDefault}
                disabled={isUploading}
                title="Reset to default avatar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {currentAvatarUrl && (
            <p className="text-xs text-gray-500 text-center">
              Click the trash icon to reset to a default avatar
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
