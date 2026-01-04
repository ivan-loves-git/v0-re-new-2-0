"use client"

import { useState, useEffect } from "react"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const CLEAR_VALUE = "__CLEAR__"

interface EditableSelectFieldProps {
  repreneurId: string
  field: string
  value: string | null | undefined
  options: readonly string[]
  placeholder?: string
  searchable?: boolean
}

export function EditableSelectField({
  repreneurId,
  field,
  value,
  options,
  placeholder = "Select...",
  searchable = false,
}: EditableSelectFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [optimisticValue, setOptimisticValue] = useState<string | null | undefined>(undefined)

  // Reset optimistic value when prop value changes (server confirmed)
  useEffect(() => {
    setOptimisticValue(undefined)
  }, [value])

  const handleChange = async (newValue: string) => {
    const valueToSave = newValue === CLEAR_VALUE ? null : newValue
    const oldValue = value

    // Optimistic update - immediately close and show new value
    setOptimisticValue(valueToSave)
    setIsEditing(false)
    setIsSaving(true)

    try {
      await updateRepreneurField(repreneurId, field, valueToSave)
      toast.success("Saved successfully")
    } catch (error) {
      console.error("Failed to update field:", error)
      toast.error("Failed to save. Please try again.")
      // Revert on error
      setOptimisticValue(undefined)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredOptions = searchable
    ? options.filter((opt) => opt.toLowerCase().includes(searchQuery.toLowerCase()))
    : options

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Select value={value || ""} onValueChange={handleChange} disabled={isSaving}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {searchable && (
              <div className="p-2">
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
            )}
            <SelectItem value={CLEAR_VALUE}>
              <span className="text-muted-foreground italic">Clear</span>
            </SelectItem>
            {filteredOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  const displayValue = optimisticValue !== undefined ? optimisticValue : value

  return (
    <div className="group flex items-center gap-2 min-h-[24px]">
      <p className={`text-sm ${isSaving ? "opacity-70" : ""}`}>
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
