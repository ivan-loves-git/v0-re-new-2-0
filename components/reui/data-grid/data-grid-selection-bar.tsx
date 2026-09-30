"use client"

// Reused unchanged selection shell from the installed ReUI radix-vega data-grid.
import type { ReactNode } from "react"
import { Subscribe } from "@tanstack/react-table"
import { useDataGrid } from "./data-grid"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function DataGridSelectionBar({
  children,
  className,
  label,
  clearLabel = "Clear",
  onClear,
}: {
  children?: ReactNode
  className?: string
  label?: (count: number) => ReactNode
  clearLabel?: ReactNode
  onClear?: () => void
}) {
  const context = useDataGrid()
  const rowSelectionAtom = context.table.atoms.rowSelection
  if (rowSelectionAtom == null) return null

  return (
    <Subscribe source={rowSelectionAtom}>
      {() => {
        // Read through the context getter: this closure re-runs on atom
        // writes without re-rendering the component, and a captured v9
        // wrapper would keep reporting the state it was built with.
        const table = context.table
        const count = table.getSelectedRowModel().rows.length
        if (count === 0) return null
        return (
          <div
            data-slot="data-grid-selection-bar"
            className={cn(
              "bg-background rounded-lg sticky inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 border px-4 py-2.5 shadow-lg",
              className
            )}
          >
            <span className="text-foreground text-sm font-medium">
              {label ? label(count) : `${count} selected`}
            </span>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
              {children}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  context.table.resetRowSelection()
                  onClear?.()
                }}
              >
                {clearLabel}
              </Button>
            </div>
          </div>
        )
      }}
    </Subscribe>
  )
}

export { DataGridSelectionBar }
