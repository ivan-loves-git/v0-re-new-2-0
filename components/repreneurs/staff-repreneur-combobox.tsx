"use client"

import * as React from "react"
import { Check, ChevronsUpDown, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface StaffRepreneurComboboxOption {
  id: string
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface StaffRepreneurComboboxProps {
  options: StaffRepreneurComboboxOption[]
  value: string | null
  onValueChange: (value: string) => void
  id?: string
  name?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  "aria-invalid"?: boolean
}

function optionName(option: StaffRepreneurComboboxOption) {
  return option.name || [option.first_name, option.last_name].filter(Boolean).join(" ").trim() || "Unnamed repreneur"
}

function optionLabel(option: StaffRepreneurComboboxOption) {
  const name = optionName(option)
  return option.email ? `${name} - ${option.email}` : name
}

function searchValue(option: StaffRepreneurComboboxOption) {
  return [optionName(option), option.email, option.id].filter(Boolean).join(" ")
}

export function StaffRepreneurCombobox({
  options,
  value,
  onValueChange,
  id,
  name,
  placeholder = "Select a repreneur",
  searchPlaceholder = "Search by name or email...",
  emptyMessage = "No repreneur found.",
  disabled = false,
  className,
  triggerClassName,
  "aria-invalid": ariaInvalid,
}: StaffRepreneurComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((option) => option.id === value) ?? null

  return (
    <div className={cn("w-full", className)}>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            disabled={disabled}
            className={cn("w-full justify-between", !selectedOption && "text-muted-foreground", triggerClassName)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedOption ? optionLabel(selectedOption) : placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={searchValue(option)}
                    onSelect={() => {
                      onValueChange(option.id)
                      setOpen(false)
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{optionName(option)}</span>
                      {option.email ? <span className="truncate text-xs text-muted-foreground">{option.email}</span> : null}
                    </div>
                    <Check className={cn("ml-2 size-4", value === option.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
