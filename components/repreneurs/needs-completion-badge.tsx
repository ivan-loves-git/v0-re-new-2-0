"use client"

import { AlertCircle, Edit } from "lucide-react"
import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

interface NeedsCompletionBadgeProps {
  repreneurId: string
  compact?: boolean
  showEditLink?: boolean
  variant?: "default" | "icon-only"
}

// Fields that need to be filled in for complete dual scoring
const MISSING_V2_FIELDS = [
  { field: "q08_crisis", label: "Gestion de crise" },
  { field: "q09_investment", label: "Décisions d'investissement" },
  { field: "q10_impact", label: "Impact personnel" },
  { field: "q11_project_status", label: "Statut du projet" },
  { field: "q14_deal_size", label: "Taille de deal" },
  { field: "q15_structure", label: "Structure de capital" },
]

export function NeedsCompletionBadge({
  repreneurId,
  compact = false,
  showEditLink = true,
  variant = "default",
}: NeedsCompletionBadgeProps) {
  // Icon-only variant for table rows
  if (variant === "icon-only") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle className="h-4 w-4 text-amber-500 cursor-help flex-shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium text-amber-700 mb-1">
              Données v2 incomplètes
            </p>
            <p className="text-xs text-muted-foreground">
              Ce profil nécessite une complétion manuelle des données pour le
              calcul des scores WHO/WHEN.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-700 cursor-help">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Données incomplètes</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium text-amber-700">
                Questionnaire v2 à compléter
              </p>
              <p className="text-sm text-muted-foreground">
                Ce profil provient de l&apos;ancien système. Certains champs
                nécessaires au double scoring WHO/WHEN doivent être complétés
                manuellement.
              </p>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Champs manquants:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {MISSING_V2_FIELDS.map((f) => (
                    <li key={f.field}>{f.label}</li>
                  ))}
                </ul>
              </div>
              {showEditLink && (
                <Link
                  href={`/repreneurs/${repreneurId}?tab=questionnaire`}
                  className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium mt-2"
                >
                  <Edit className="h-3 w-3" />
                  Compléter le questionnaire
                </Link>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div>
            <p className="font-medium text-amber-800">
              Données incomplètes pour le double scoring
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Ce profil provient de l&apos;ancien système (Flatchr/Legacy).
              Certains champs nécessaires au calcul des scores WHO/WHEN doivent
              être complétés manuellement.
            </p>
          </div>

          <div className="text-sm text-amber-700">
            <p className="font-medium mb-1">Champs à compléter:</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside">
              {MISSING_V2_FIELDS.map((f) => (
                <li key={f.field}>{f.label}</li>
              ))}
            </ul>
          </div>

          {showEditLink && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            >
              <Link href={`/repreneurs/${repreneurId}?tab=questionnaire`}>
                <Edit className="h-4 w-4 mr-2" />
                Compléter le questionnaire v2
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
