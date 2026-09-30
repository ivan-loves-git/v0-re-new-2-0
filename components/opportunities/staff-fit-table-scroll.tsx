"use client"

import type { KeyboardEvent, ReactNode } from "react"

type StaffFitTableScrollProps = {
  children: ReactNode
  className?: string
}

export function StaffFitTableScroll({ children, className }: StaffFitTableScrollProps) {
  function scrollTableOnKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return
    const container = event.currentTarget.querySelector<HTMLElement>("[data-slot='table-container']")
    if (!container || container.scrollWidth <= container.clientWidth) return
    event.preventDefault()
    container.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * Math.max(180, container.clientWidth * 0.75) })
  }

  return (
    <div className={className}>
      <div role="region" tabIndex={0} aria-label="Opportunity matches; use arrow keys to read Fit and freshness" onKeyDown={scrollTableOnKey}>
        {children}
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground sm:hidden">Swipe across the table or use the arrow keys to see Fit and freshness.</p>
    </div>
  )
}
