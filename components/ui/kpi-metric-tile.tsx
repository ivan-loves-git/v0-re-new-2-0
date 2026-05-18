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

const toneClasses: Record<KpiTone, { icon: string; iconBg: string }> = {
  email: { icon: "text-blue-600", iconBg: "bg-blue-50" },
  repreneur: { icon: "text-green-600", iconBg: "bg-green-50" },
  score: { icon: "text-violet-600", iconBg: "bg-violet-50" },
  opportunity: { icon: "text-teal-600", iconBg: "bg-teal-50" },
  attention: { icon: "text-amber-600", iconBg: "bg-amber-50" },
  risk: { icon: "text-red-600", iconBg: "bg-red-50" },
  neutral: { icon: "text-muted-foreground", iconBg: "bg-muted" },
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
        "relative min-h-28 gap-0 rounded-md py-0 shadow-sm",
        className
      )}
    >
      <div className="flex h-full min-w-0 flex-col gap-2 p-2.5">
        <button
          type="button"
          aria-label={`About ${title}`}
          className="group/info absolute right-2 top-2 z-10 inline-grid size-[17px] place-items-center rounded-full border border-gray-200 bg-muted text-muted-foreground shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-gray-300 hover:bg-background hover:text-gray-600 focus-visible:border-gray-300 focus-visible:bg-background focus-visible:text-gray-600 focus-visible:outline-none"
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

        <div className="flex min-w-0 items-start gap-2 pr-5">
          <div className={cn("grid size-[26px] shrink-0 place-items-center rounded-md", colors.iconBg)}>
            <Icon className={cn("size-4", colors.icon)} />
          </div>
          <div className="-mt-0.5 min-w-0">
            <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">{title}</p>
            <p className="mt-[3px] truncate text-[10px] leading-tight text-muted-foreground">{period}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-start gap-[3px]">
          <div className="text-[22px] font-semibold leading-none tracking-normal text-foreground tabular-nums">
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
    <div className={cn("grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-8", className)}>
      {children}
    </div>
  )
}
