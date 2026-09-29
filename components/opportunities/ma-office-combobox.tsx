"use client"

import { useId, useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { matchesMaOfficeSearch, presentMaOfficeOptions, type MaOfficeIdentity } from "@/lib/ma-office-presentation"
import { cn } from "@/lib/utils"

interface MaOfficeComboboxProps {
  id: string
  offices: readonly MaOfficeIdentity[]
  value: string
  onValueChange: (officeId: string) => void
  allowAll?: boolean
}

export function MaOfficeCombobox({ id, offices, value, onValueChange, allowAll = false }: MaOfficeComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const popupId = useId()
  const options = useMemo(() => presentMaOfficeOptions(offices), [offices])
  const selected = options.find((office) => office.id === value)
  const filtered = options.filter((office) => matchesMaOfficeSearch(office.searchText, query))
  const selectedDetailId = `${id}-identity`
  const select = (officeId: string) => {
    onValueChange(officeId)
    setOpen(false)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setQuery("") }}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox"
            aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? popupId : undefined}
            aria-describedby={selected ? selectedDetailId : undefined}
            className="w-full min-w-0 justify-between">
            <span className="truncate">{selected?.label ?? (allowAll && value === "all" ? "All offices" : "Choose office")}</span>
            <ChevronsUpDown data-icon="inline-end" className="shrink-0" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent id={popupId} align="start" collisionPadding={12}
          className="w-[max(var(--radix-popover-trigger-width),22rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0">
          <Command shouldFilter={false} label="Search by firm or office">
            <CommandInput aria-label="Search by firm or office" placeholder="Search by firm or office…"
              value={query} onValueChange={setQuery} className="text-base md:text-sm" />
            <CommandList
              className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-3rem))] overscroll-contain">
              <CommandEmpty>No offices match. Try another name or clear the search.</CommandEmpty>
              {allowAll && matchesMaOfficeSearch("All offices", query) ? (
                <CommandGroup>
                  <CommandItem value="all" onSelect={() => select("all")}>
                    All offices
                    {value === "all" ? <Check className="ml-auto" aria-hidden="true" /> : null}
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {[false, true].map((review) => {
                const group = filtered.filter((office) => office.needsReview === review)
                if (!group.length) return null
                return (
                  <CommandGroup key={String(review)} heading={review ? "Needs review" : "Offices"}>
                    {group.map((office) => (
                      <CommandItem key={office.id} value={office.id} onSelect={() => select(office.id)}
                        className="min-h-11 items-start" aria-label={`${office.identity}${office.isProvisionalSource ? "; Provisional source" : ""}`}>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="font-medium break-words">{office.primary}</span>
                          {office.secondary ? <span className="text-xs text-muted-foreground break-words">{office.secondary === "Office name missing" ? office.secondary : `Office: ${office.secondary}`}</span> : null}
                          {office.reference ? <span className="text-xs text-muted-foreground break-all">{office.reference}</span> : null}
                          {office.isProvisionalSource ? <Badge variant="outline">Provisional source</Badge> : null}
                        </div>
                        <Check className={cn("mt-0.5 shrink-0", value === office.id ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? (
        <p id={selectedDetailId} className="text-xs text-muted-foreground break-words">
          <span className="sr-only">{selected.identity}. </span>
          <span aria-hidden="true">Office: {offices.find((office) => office.id === selected.id)?.officeName || "Name missing"}</span>
          {selected.reference ? <span className="block break-all" aria-hidden="true">{selected.reference}</span> : null}
          {selected.isProvisionalSource ? <span className="block">Provisional source</span> : null}
        </p>
      ) : null}
    </div>
  )
}
