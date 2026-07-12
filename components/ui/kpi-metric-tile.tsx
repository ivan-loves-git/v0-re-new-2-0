import type { ReactNode } from "react"
import {
  ArrowDown,
  ArrowUp,
  Info,
  Minus,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type KpiTone = "email" | "repreneur" | "score" | "opportunity" | "attention" | "risk" | "neutral"
type KpiTrendDirection = "up" | "down" | "flat"
type KpiTrendTone = "positive" | "negative" | "neutral"

export interface KpiInfo {
  title: string
  description: string
  why?: string
}

export interface KpiTrend {
  value?: string | number | null
  direction?: KpiTrendDirection
  tone?: KpiTrendTone
}

export interface KpiMetricTileProps {
  title: string
  value: ReactNode
  period: string
  icon: LucideIcon
  tone?: KpiTone
  trend?: KpiTrend | null
  info: KpiInfo
  className?: string
}

const toneClasses: Record<KpiTone, { icon: string; iconBg: string; marker: string }> = {
  email: { icon: "text-blue-700", iconBg: "bg-blue-50", marker: "bg-blue-600" },
  repreneur: { icon: "text-teal-700", iconBg: "bg-teal-50", marker: "bg-teal-600" },
  score: { icon: "text-indigo-700", iconBg: "bg-indigo-50", marker: "bg-indigo-600" },
  opportunity: { icon: "text-cyan-700", iconBg: "bg-cyan-50", marker: "bg-cyan-600" },
  attention: { icon: "text-amber-700", iconBg: "bg-amber-50", marker: "bg-amber-600" },
  risk: { icon: "text-red-700", iconBg: "bg-red-50", marker: "bg-red-600" },
  neutral: { icon: "text-slate-600", iconBg: "bg-slate-50", marker: "bg-slate-500" },
}

const trendToneClasses: Record<KpiTrendTone, string> = {
  positive: "text-green-600/80",
  negative: "text-red-600/80",
  neutral: "text-muted-foreground",
}

function normalizedTrend(trend: KpiTrend | null | undefined): Required<KpiTrend> {
  if (!trend || trend.value === null || trend.value === undefined || trend.value === "" || trend.value === 0 || trend.value === "0") {
    return { value: "-", direction: "flat", tone: "neutral" }
  }

  return {
    value: trend.value,
    direction: trend.direction ?? "flat",
    tone: trend.tone ?? "neutral",
  }
}

function TrendIcon({ direction }: { direction: KpiTrendDirection }) {
  if (direction === "up") return <ArrowUp className="size-3" strokeWidth={2.8} />
  if (direction === "down") return <ArrowDown className="size-3" strokeWidth={2.8} />
  return <Minus className="size-3" strokeWidth={2.8} />
}

export function KpiMetricTile({
  title,
  value,
  period,
  icon: Icon,
  tone = "neutral",
  trend,
  info,
  className,
}: KpiMetricTileProps) {
  const colors = toneClasses[tone]
  const normalized = normalizedTrend(trend)

  return (
    <Card
      className={cn(
        "relative min-h-[118px] gap-0 rounded-none border-0 bg-transparent py-0 shadow-none transition-colors hover:bg-muted/35",
        className
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-x-4 top-0 h-0.5 opacity-80", colors.marker)} />
      <div className="flex h-full min-w-0 flex-col gap-2 p-4">
        <button
          type="button"
          aria-label={`About ${title}`}
          className="group/info absolute right-3 top-3 z-10 inline-grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3" />
          <span className="pointer-events-none absolute right-0 top-6 z-50 hidden w-64 rounded-md border bg-popover p-3 text-left text-popover-foreground shadow-md group-hover/info:block group-focus-visible/info:block">
            <span className="block text-sm font-medium">{info.title}</span>
            <span className="mt-1 block text-xs leading-snug text-muted-foreground">{info.description}</span>
            {info.why && (
              <span className="mt-2 block text-xs leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">Why it matters:</span> {info.why}
              </span>
            )}
          </span>
        </button>

        <div className="flex min-w-0 items-start gap-2.5 pr-6">
          <div className={cn("grid size-7 shrink-0 place-items-center rounded-md", colors.iconBg)}>
            <Icon className={cn("size-3.5", colors.icon)} strokeWidth={2} />
          </div>
          <div className="-mt-0.5 min-w-0">
            <p className="line-clamp-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.045em] text-muted-foreground">{title}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground/80">{period}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-start gap-[3px]">
          <div className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums">
            {value}
          </div>
          <div className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold leading-none tabular-nums", trendToneClasses[normalized.tone])}>
            <TrendIcon direction={normalized.direction} />
            {normalized.value}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function KpiMetricGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-2 rounded-lg border bg-card sm:grid-cols-4 xl:grid-cols-8 [&>[data-slot=card]]:border-b [&>[data-slot=card]]:border-r", className)}>
      {children}
    </div>
  )
}
