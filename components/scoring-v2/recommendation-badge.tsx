"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Rocket, MessageSquare, Users, BookOpen } from "lucide-react"
import type { RecommendedAction } from "./types"

interface RecommendationBadgeProps {
  recommendation: RecommendedAction | string | null
  showTooltip?: boolean
  size?: "sm" | "md" | "lg"
}

const RECOMMENDATION_CONFIG: Record<string, {
  label: string
  labelFr: string
  description: string
  descriptionFr: string
  color: string
  bgColor: string
  icon: React.ElementType
}> = {
  deal_flow: {
    label: "Deal Flow",
    labelFr: "Deal Flow",
    description: "Strong profile + framed project. Priority access to deals.",
    descriptionFr: "Profil solide + projet cadré. Accès prioritaire aux opportunités.",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
    icon: Rocket,
  },
  priority_interview: {
    label: "Priority Interview",
    labelFr: "Entretien prioritaire",
    description: "Strong profile. Schedule interview to validate thesis.",
    descriptionFr: "Profil solide. Planifier un entretien pour valider la thèse.",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
    icon: MessageSquare,
  },
  interview_validate_thesis: {
    label: "Interview",
    labelFr: "Entretien",
    description: "Strong profile. Schedule interview to validate thesis.",
    descriptionFr: "Profil solide. Planifier un entretien pour valider la thèse.",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
    icon: MessageSquare,
  },
  interview: {
    label: "Interview",
    labelFr: "Entretien",
    description: "Framed project. Schedule interview to validate execution capacity.",
    descriptionFr: "Projet cadré. Planifier un entretien pour valider la capacité d'exécution.",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
    icon: Users,
  },
  interview_validate_execution: {
    label: "Interview",
    labelFr: "Entretien",
    description: "Framed project. Schedule interview to validate execution capacity.",
    descriptionFr: "Projet cadré. Planifier un entretien pour valider la capacité d'exécution.",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
    icon: Users,
  },
  starter_pack: {
    label: "Starter Pack",
    labelFr: "Starter Pack",
    description: "Explorer profile. Offer educational resources and clarification call.",
    descriptionFr: "Profil explorateur. Proposer ressources et appel de clarification.",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
    icon: BookOpen,
  },
}

export function RecommendationBadge({
  recommendation,
  showTooltip = true,
  size = "md",
}: RecommendationBadgeProps) {
  if (!recommendation) return null

  const config = RECOMMENDATION_CONFIG[recommendation]
  if (!config) {
    // Fallback for unknown recommendations
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {recommendation}
      </Badge>
    )
  }

  const Icon = config.icon
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  const badge = (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.labelFr}</span>
    </div>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-sm text-muted-foreground">{config.descriptionFr}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact version for tables - just shows colored dot with label
 */
export function RecommendationDot({
  recommendation,
}: {
  recommendation: RecommendedAction | string | null
}) {
  if (!recommendation) return null

  const config = RECOMMENDATION_CONFIG[recommendation]
  if (!config) return null

  const dotColors: Record<string, string> = {
    deal_flow: "bg-green-500",
    priority_interview: "bg-blue-500",
    interview_validate_thesis: "bg-blue-500",
    interview: "bg-blue-500",
    interview_validate_execution: "bg-blue-500",
    starter_pack: "bg-amber-500",
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${dotColors[recommendation] || "bg-gray-400"}`} />
            <span className="text-sm text-muted-foreground">{config.labelFr}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-sm">{config.descriptionFr}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
