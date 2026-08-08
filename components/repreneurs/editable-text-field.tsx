"use client"

import { useState, useRef, useEffect } from "react"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"
import { FieldError, FormFieldLabel, fieldErrorProps } from "@/components/forms/validation-feedback"

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
  const [error, setError] = useState<string>()
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

    if (field === "email") {
      if (!editValue.trim()) {
        setError("Enter an email address.")
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editValue.trim())) {
        setError("Enter a valid email address.")
        return
      }
    }
    setError(undefined)

    // Optimistic update - immediately close and show new value
    setOptimisticValue(editValue)
    setIsEditing(false)
    setIsSaving(true)

    try {
      await updateRepreneurField(repreneurId, field, newValue)
      toast.success("Saved successfully")
    } catch (error) {
      console.error("Repreneur field update failed")
      const message = error instanceof Error ? error.message : "Failed to save. Please try again."
      setError(message)
      setIsEditing(true)
      setOptimisticValue(null)
      toast.error("Failed to save", { description: message })
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
    const fieldId = `repreneur-${field}`
    return (
      <div className="space-y-2">
        <FormFieldLabel
          htmlFor={fieldId}
          requirement={field === "email" ? "required" : "optional"}
        >
          {label}
        </FormFieldLabel>
        {type === "textarea" ? (
          <Textarea
            id={fieldId}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); setError(undefined) }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={4}
            className="text-sm"
            {...fieldErrorProps(`repreneur-${field}`, error)}
          />
        ) : (
          <Input
            id={fieldId}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={editValue}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="text-sm"
            {...fieldErrorProps(`repreneur-${field}`, error)}
            onChange={(e) => { setEditValue(e.target.value); setError(undefined) }}
          />
        )}
        <FieldError id={`repreneur-${field}`} message={error} />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Check className="size-3 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="size-3 mr-1" />
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
        className="size-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => setIsEditing(true)}
        disabled={isSaving}
      >
        <Pencil className="size-3" />
      </Button>
    </div>
  )
}
