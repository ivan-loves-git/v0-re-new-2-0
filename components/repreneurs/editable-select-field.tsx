"use client"

import { useState } from "react"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const handleChange = async (newValue: string) => {
    setIsSaving(true)
    try {
      const valueToSave = newValue === CLEAR_VALUE ? null : newValue
      await updateRepreneurField(repreneurId, field, valueToSave)
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update field:", error)
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

  return (
    <div className="group flex items-center gap-2 min-h-[24px]">
      <p className="text-sm">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  )
}
