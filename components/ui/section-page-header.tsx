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

const toneClasses: Record<SectionTone, { icon: string; iconBg: string; ring: string }> = {
  repreneur: {
    icon: "text-green-600",
    iconBg: "bg-green-50",
    ring: "ring-green-100",
  },
  opportunity: {
    icon: "text-purple-600",
    iconBg: "bg-purple-50",
    ring: "ring-purple-100",
  },
  neutral: {
    icon: "text-muted-foreground",
    iconBg: "bg-muted",
    ring: "ring-border",
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
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        <div className={cn("grid size-14 shrink-0 place-items-center rounded-xl ring-1", colors.iconBg, colors.ring)}>
          <Icon className={cn("size-7", colors.icon)} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:pt-1">{actions}</div> : null}
    </div>
  )
}
