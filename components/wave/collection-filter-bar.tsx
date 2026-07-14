"use client"

import { useState } from "react"
import { ListFilter, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  getCollectionFilterLabel,
  type CollectionFilterDefinition,
  type CollectionFilterValues,
} from "@/lib/collection-filter-state"

interface CollectionFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  definitions: CollectionFilterDefinition[]
  values: CollectionFilterValues
  onFilterChange: (key: string, value: string) => void
  onFilterRemove: (key: string) => void
  onClearFilters: () => void
  onReset: () => void
  resultCount: number
  totalCount: number
  resultLabel: string
  className?: string
  actions?: React.ReactNode
}

function FilterPicker({
  definitions,
  values,
  onFilterChange,
  onDone,
}: Pick<CollectionFilterBarProps, "definitions" | "values" | "onFilterChange"> & { onDone?: () => void }) {
  const available = definitions.filter((definition) => !values[definition.key])

  if (available.length === 0) {
    return <p className="px-1 py-2 text-sm text-muted-foreground">All filters are already visible.</p>
  }

  return (
    <div className="grid gap-1">
      {available.map((definition) => (
        <div key={definition.key} className="rounded-md border p-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{definition.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {definition.options.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 justify-start"
                onClick={() => {
                  onFilterChange(definition.key, option.value)
                  onDone?.()
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActiveFilterChip({
  definition,
  value,
  onChange,
  onRemove,
}: {
  definition: CollectionFilterDefinition
  value: string
  onChange: (value: string) => void
  onRemove: () => void
}) {
  return (
    <div className="inline-flex h-8 max-w-full items-center overflow-hidden rounded-md border border-primary/20 bg-primary/5 text-xs shadow-xs">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="min-w-0 truncate px-2.5 font-medium hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-muted-foreground">{definition.label}:</span>{" "}
            {getCollectionFilterLabel(definition, value)}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[min(70vh,28rem)] w-56 overflow-y-auto p-2">
          <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">Change {definition.label.toLowerCase()}</p>
          <div className="grid gap-1">
            {definition.options.map((option) => (
              <Button key={option.value} type="button" variant={option.value === value ? "secondary" : "ghost"} size="sm" className="justify-start" onClick={() => onChange(option.value)}>
                {option.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button type="button" aria-label={`Remove ${definition.label} filter`} className="grid size-8 shrink-0 place-items-center border-l border-primary/15 text-muted-foreground hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onRemove}>
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function CollectionFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  definitions,
  values,
  onFilterChange,
  onFilterRemove,
  onClearFilters,
  onReset,
  resultCount,
  totalCount,
  resultLabel,
  className,
  actions,
}: CollectionFilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const activeDefinitions = definitions.filter((definition) => values[definition.key])
  const hiddenCount = Math.max(0, activeDefinitions.length - 4)
  const hasFilters = activeDefinitions.length > 0
  const hasAnyState = hasFilters || search.trim().length > 0
  const resultLabelText = resultCount === 1
    ? resultLabel
    : resultLabel.endsWith("y")
      ? `${resultLabel.slice(0, -1)}ies`
      : `${resultLabel}s`

  return (
    <section className={cn("rounded-lg border bg-card p-3", className)} aria-label="Collection filters">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={searchPlaceholder} name="collection-search" autoComplete="off" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} className="h-9 bg-background pl-9 pr-9" />
            {search ? (
              <button type="button" aria-label="Clear search" onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="hidden h-9 border-dashed bg-background md:inline-flex">
                <ListFilter data-icon="inline-start" />
                Add filter
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-[min(70vh,34rem)] w-[360px] overflow-y-auto p-2">
              <FilterPicker definitions={definitions} values={values} onFilterChange={onFilterChange} onDone={() => setDesktopOpen(false)} />
            </PopoverContent>
          </Popover>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 border-dashed bg-background md:hidden">
                <ListFilter data-icon="inline-start" />
                Add filter
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-xl p-4">
              <SheetHeader className="px-0 text-left">
                <SheetTitle>Add a filter</SheetTitle>
                <SheetDescription>Choose only the criteria you need. Active filters remain visible as removable chips.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <FilterPicker definitions={definitions} values={values} onFilterChange={onFilterChange} onDone={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {activeDefinitions.slice(0, 4).map((definition) => (
            <ActiveFilterChip key={definition.key} definition={definition} value={values[definition.key]} onChange={(value) => onFilterChange(definition.key, value)} onRemove={() => onFilterRemove(definition.key)} />
          ))}
          {hiddenCount > 0 ? (
            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground">
                  +{hiddenCount} active
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-[min(70vh,28rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">More active filters</p>
                <div className="flex flex-wrap gap-2">
                  {activeDefinitions.slice(4).map((definition) => (
                    <ActiveFilterChip key={definition.key} definition={definition} value={values[definition.key]} onChange={(value) => onFilterChange(definition.key, value)} onRemove={() => onFilterRemove(definition.key)} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasFilters ? <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClearFilters}>Clear filters</Button> : null}
          {hasAnyState ? <Button type="button" variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={onReset}>Reset all</Button> : null}
          {actions}
        </div>
      </div>

      <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground" role="status" aria-live="polite">
        <span className="font-medium text-foreground">{resultCount}</span> {resultLabelText}
        {hasAnyState ? ` filtered from ${totalCount}` : " in the full list"}
      </p>
    </section>
  )
}
