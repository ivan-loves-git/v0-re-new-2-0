"use client"

import { useState, useRef, useEffect } from "react"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"

interface EditableTextFieldProps {
  repreneurId: string
  field: string
  value: string | null | undefined
  label: string
  type?: "text" | "textarea" | "email" | "tel"
  placeholder?: string
  textClassName?: string
}

export function EditableTextField({
  repreneurId,
  field,
  value,
  label,
  type = "text",
  placeholder,
  textClassName = "text-sm",
}: EditableTextFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || "")
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  // Reset optimistic value when prop value changes (server confirmed)
  useEffect(() => {
    setOptimisticValue(null)
  }, [value])

  const handleSave = async () => {
    const newValue = editValue || null
    const oldValue = value || ""

    // Optimistic update - immediately close and show new value
    setOptimisticValue(editValue)
    setIsEditing(false)
    setIsSaving(true)

    try {
      await updateRepreneurField(repreneurId, field, newValue)
      toast.success("Saved successfully")
    } catch (error) {
      console.error("Failed to update field:", error)
      toast.error("Failed to save. Please try again.")
      // Revert on error
      setOptimisticValue(null)
      setEditValue(oldValue)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || "")
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-2">
        {type === "textarea" ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={4}
            className="text-sm"
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="text-sm"
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Check className="h-3 w-3 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const displayValue = optimisticValue !== null ? optimisticValue : value

  return (
    <div className="group flex items-center gap-2 min-h-[24px]">
      <p className={`${textClassName} ${isSaving ? "opacity-70" : ""}`}>
        {displayValue || <span className="text-muted-foreground italic">Not set</span>}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => setIsEditing(true)}
        disabled={isSaving}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  )
}
