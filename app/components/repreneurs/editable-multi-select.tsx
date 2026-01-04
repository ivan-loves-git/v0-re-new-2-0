"use client"

import { useState } from "react"
import { updateRepreneurField } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pencil, X, Check, Plus } from "lucide-react"
import { toast } from "sonner"

interface EditableMultiSelectProps {
  repreneurId: string
  field: string
  value: string[] | null | undefined
  options: readonly string[]
  placeholder?: string
}

export function EditableMultiSelect({
  repreneurId,
  field,
  value,
  options,
  placeholder = "Select items...",
}: EditableMultiSelectProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>(value || [])
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleToggle = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateRepreneurField(repreneurId, field, selectedItems.length > 0 ? selectedItems : null)
      setIsEditing(false)
      toast.success("Saved successfully")
    } catch (error) {
      console.error("Failed to update field:", error)
      toast.error("Failed to save. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setSelectedItems(value || [])
    setIsEditing(false)
  }

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isEditing) {
    return (
      <div className="space-y-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <Plus className="h-4 w-4 mr-2" />
              {selectedItems.length > 0
                ? `${selectedItems.length} selected`
                : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
              />
            </div>
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {filteredOptions.map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => handleToggle(option)}
                  >
                    <Checkbox checked={selectedItems.includes(option)} />
                    <span className="text-sm">{option}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedItems.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleToggle(item)}
              >
                {item}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Check className="h-3 w-3 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2 min-h-[24px]">
        {value && value.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map((item) => (
              <Badge key={item} variant="outline" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Not set</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
