import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

type AsChildProps = {
  asChild?: boolean
}

export function WaveMicroLabel({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"p"> & AsChildProps) {
  const Comp = asChild ? Slot : "p"

  return (
    <Comp
      data-slot="wave-micro-label"
      className={cn("wave-micro-label", className)}
      {...props}
    />
  )
}

export function WavePanel({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & AsChildProps) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="wave-panel"
      className={cn("wave-panel", className)}
      {...props}
    />
  )
}

export function WaveSemanticPanel({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & AsChildProps) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="wave-semantic-panel"
      className={cn("wave-semantic-panel", className)}
      {...props}
    />
  )
}

export function WaveSegmentedSummary({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wave-segmented-summary"
      className={cn("wave-segmented-summary", className)}
      {...props}
    />
  )
}

export function WaveSegmentedMetric({
  value,
  label,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: React.ReactNode
  label: React.ReactNode
}) {
  return (
    <div
      data-slot="wave-segmented-metric"
      className={cn("wave-segmented-metric", className)}
      {...props}
    >
      <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
