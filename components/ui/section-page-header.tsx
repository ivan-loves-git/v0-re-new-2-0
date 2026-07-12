import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type SectionTone = "repreneur" | "opportunity" | "neutral"

interface SectionPageHeaderProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  tone?: SectionTone
  actions?: ReactNode
  className?: string
}

const toneClasses: Record<SectionTone, { icon: string; iconBg: string; marker: string }> = {
  repreneur: {
    icon: "text-teal-700",
    iconBg: "bg-teal-50",
    marker: "bg-teal-600",
  },
  opportunity: {
    icon: "text-blue-700",
    iconBg: "bg-blue-50",
    marker: "bg-blue-600",
  },
  neutral: {
    icon: "text-slate-600",
    iconBg: "bg-muted",
    marker: "bg-slate-500",
  },
}

export function SectionPageHeader({
  title,
  subtitle,
  icon: Icon,
  tone = "neutral",
  actions,
  className,
}: SectionPageHeaderProps) {
  const colors = toneClasses[tone]

  return (
    <header className={cn("relative flex flex-col gap-4 border-b border-border/80 pb-5 md:flex-row md:items-start md:justify-between", className)}>
      <span aria-hidden="true" className={cn("absolute -bottom-px left-0 h-0.5 w-12", colors.marker)} />
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg border border-border/70", colors.iconBg)}>
          <Icon className={cn("size-5", colors.icon)} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-8 tracking-[-0.025em] text-foreground">{title}</h1>
          {subtitle ? <p className="mt-0.5 max-w-3xl text-[13px] leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
