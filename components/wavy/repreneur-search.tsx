"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface RepreneurOption {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  t1Score?: number | null
  whenScore?: number | null
  journeyStage?: string | null
}

interface RepreneurSearchProps {
  repreneurs: RepreneurOption[]
  value: RepreneurOption | null
  onSelect: (repreneur: RepreneurOption | null) => void
  placeholder?: string
  disabled?: boolean
}

export function RepreneurSearch({
  repreneurs,
  value,
  onSelect,
  placeholder = "Select a repreneur...",
  disabled = false,
}: RepreneurSearchProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value ? (
            <span className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              {value.firstName} {value.lastName}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or email..." />
          <CommandList>
            <CommandEmpty>No repreneur found.</CommandEmpty>
            <CommandGroup>
              {repreneurs.map((repreneur) => (
                <CommandItem
                  key={repreneur.id}
                  value={`${repreneur.firstName} ${repreneur.lastName} ${repreneur.email}`}
                  onSelect={() => {
                    onSelect(repreneur.id === value?.id ? null : repreneur)
                    setOpen(false)
                  }}
                >
                  <div className="flex flex-1 items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {repreneur.firstName} {repreneur.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {repreneur.email}
                      </span>
                    </div>
                    {repreneur.t1Score && (
                      <div className="flex gap-1.5 text-xs">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          T1: {repreneur.t1Score}
                        </span>
                      </div>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value?.id === repreneur.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
