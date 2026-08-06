"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User } from "lucide-react"
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

export interface WaveAiRepreneurOption {
  id: string
  firstName: string
  lastName: string
  email: string
  whoScore?: number | null
  whenScore?: number | null
  journeyStage?: string | null
}

export function WaveAiRepreneurSearch({
  repreneurs,
  value,
  onSelect,
  disabled,
}: {
  repreneurs: WaveAiRepreneurOption[]
  value: WaveAiRepreneurOption | null
  onSelect: (value: WaveAiRepreneurOption | null) => void
  disabled?: boolean
}) {
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
            <span className="flex min-w-0 items-center gap-2">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{value.firstName} {value.lastName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select a repreneur</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or email" />
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
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">
                      {repreneur.firstName} {repreneur.lastName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{repreneur.email}</span>
                  </span>
                  <Check className={cn("ml-2 size-4", value?.id === repreneur.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

