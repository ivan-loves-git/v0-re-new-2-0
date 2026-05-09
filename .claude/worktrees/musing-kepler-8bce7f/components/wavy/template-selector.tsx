"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BUILT_IN_TEMPLATES } from "@/lib/prompts/wavy-system"

export interface Template {
  id: string
  name: string
  description: string
  channel: "email" | "whatsapp"
  isBuiltIn?: boolean
}

interface TemplateSelectorProps {
  channel: "email" | "whatsapp"
  value: string | null
  onChange: (templateId: string | null) => void
  customTemplates: Template[]
  onAddTemplate?: (template: { name: string; description: string; channel: "email" | "whatsapp" }) => void
  onDeleteTemplate?: (templateId: string) => void
}

export function TemplateSelector({
  channel,
  value,
  onChange,
  customTemplates,
  onAddTemplate,
  onDeleteTemplate,
}: TemplateSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [newTemplateName, setNewTemplateName] = React.useState("")
  const [newTemplateDescription, setNewTemplateDescription] = React.useState("")

  // Filter templates by channel
  const filteredBuiltIn = BUILT_IN_TEMPLATES.filter(t => t.channel === channel)
  const filteredCustom = customTemplates.filter(t => t.channel === channel)

  // Find selected template
  const selectedTemplate = value
    ? [...filteredBuiltIn.map(t => ({ ...t, isBuiltIn: true })), ...filteredCustom].find(t => t.id === value)
    : null

  const handleAddTemplate = () => {
    if (newTemplateName && newTemplateDescription && onAddTemplate) {
      onAddTemplate({
        name: newTemplateName,
        description: newTemplateDescription,
        channel,
      })
      setNewTemplateName("")
      setNewTemplateDescription("")
      setAddDialogOpen(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTemplate ? (
              <span>{selectedTemplate.name}</span>
            ) : (
              <span className="text-muted-foreground">Select a template...</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search templates..." />
            <CommandList>
              <CommandEmpty>No template found.</CommandEmpty>

              {/* Built-in templates */}
              <CommandGroup heading="Built-in Templates">
                {filteredBuiltIn.map((template) => (
                  <CommandItem
                    key={template.id}
                    value={`${template.name} ${template.description}`}
                    onSelect={() => {
                      onChange(template.id === value ? null : template.id)
                      setOpen(false)
                    }}
                  >
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {template.description}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "ml-2 size-4",
                        value === template.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>

              {/* Custom templates */}
              {filteredCustom.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Custom Templates">
                    {filteredCustom.map((template) => (
                      <CommandItem
                        key={template.id}
                        value={`${template.name} ${template.description}`}
                        onSelect={() => {
                          onChange(template.id === value ? null : template.id)
                          setOpen(false)
                        }}
                      >
                        <div className="flex flex-1 flex-col">
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {template.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Check
                            className={cn(
                              "size-4",
                              value === template.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {onDeleteTemplate && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-6 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteTemplate(template.id)
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Add custom template */}
              {onAddTemplate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false)
                        setAddDialogOpen(true)
                      }}
                    >
                      <Plus className="mr-2 size-4" />
                      <span>Create custom template</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Add Template Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Template</DialogTitle>
            <DialogDescription>
              Add a new template for {channel === "email" ? "emails" : "WhatsApp messages"}.
              Wavy will use the description to understand the tone and purpose.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly Check-in"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
                When should this template be used?
              </Label>
              <Textarea
                id="description"
                placeholder="e.g., Used for regular monthly check-ins with repreneurs who are actively progressing. Friendly, encouraging tone."
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about the context, tone, and purpose. Wavy uses this to craft appropriate messages.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTemplate}
              disabled={!newTemplateName || !newTemplateDescription}
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
