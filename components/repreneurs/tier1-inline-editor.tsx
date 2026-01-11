"use client"

import { useState, useTransition } from "react"
import { Check, ChevronDown, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateTier1Answer } from "@/lib/actions/repreneurs"
import type { Repreneur } from "@/lib/types/repreneur"
import {
  EMPLOYMENT_STATUS_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  EXECUTIVE_ROLE_OPTIONS,
  JOURNEY_STAGE_OPTIONS,
  INVESTMENT_CAPACITY_OPTIONS,
  FUNDING_STATUS_OPTIONS,
  NETWORK_TRAINING_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS,
} from "@/lib/utils/tier1-scoring"

interface Tier1InlineEditorProps {
  repreneur: Repreneur
}

// Question configuration
const QUESTIONS = [
  {
    key: "q1_employment_status",
    label: "Statut professionnel",
    type: "select" as const,
    options: EMPLOYMENT_STATUS_OPTIONS,
  },
  {
    key: "q2_years_experience",
    label: "Années d'expérience",
    type: "select" as const,
    options: YEARS_EXPERIENCE_OPTIONS,
  },
  {
    key: "q3_industry_sectors",
    label: "Secteurs d'expérience",
    type: "multiselect" as const,
    options: INDUSTRY_SECTOR_OPTIONS,
    searchable: true,
  },
  {
    key: "q4_has_ma_experience",
    label: "Expérience M&A",
    type: "boolean" as const,
  },
  {
    key: "q5_team_size",
    label: "Taille équipe gérée",
    type: "select" as const,
    options: TEAM_SIZE_OPTIONS,
  },
  {
    key: "q6_involved_in_ma",
    label: "Impliqué dans M&A",
    type: "boolean" as const,
  },
  {
    key: "q8_executive_roles",
    label: "Rôles exécutifs",
    type: "multiselect" as const,
    options: EXECUTIVE_ROLE_OPTIONS,
    searchable: true,
  },
  {
    key: "q9_board_experience",
    label: "Expérience conseil",
    type: "boolean" as const,
  },
  {
    key: "q10_journey_stages",
    label: "Étape du parcours",
    type: "multiselect" as const,
    options: JOURNEY_STAGE_OPTIONS,
    searchable: true,
  },
  {
    key: "q11_target_sectors",
    label: "Secteurs cibles",
    type: "multiselect" as const,
    options: INDUSTRY_SECTOR_OPTIONS,
    searchable: true,
  },
  {
    key: "q12_has_identified_targets",
    label: "Cibles identifiées",
    type: "boolean" as const,
  },
  {
    key: "q14_investment_capacity",
    label: "Capacité d'investissement",
    type: "select" as const,
    options: INVESTMENT_CAPACITY_OPTIONS,
  },
  {
    key: "q15_funding_status",
    label: "État du financement",
    type: "select" as const,
    options: FUNDING_STATUS_OPTIONS,
  },
  {
    key: "q16_network_training",
    label: "Réseau / Formation",
    type: "multiselect" as const,
    options: NETWORK_TRAINING_OPTIONS,
  },
  {
    key: "q17_open_to_co_acquisition",
    label: "Ouvert co-acquisition",
    type: "boolean" as const,
  },
]

export function Tier1InlineEditor({ repreneur }: Tier1InlineEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [updatingField, setUpdatingField] = useState<string | null>(null)

  const handleUpdate = async (field: string, value: string | string[] | boolean | null) => {
    setUpdatingField(field)
    startTransition(async () => {
      try {
        await updateTier1Answer(repreneur.id, field, value)
        toast.success("Score mis à jour")
      } catch (error) {
        toast.error("Erreur lors de la mise à jour")
        console.error(error)
      } finally {
        setUpdatingField(null)
      }
    })
  }

  const getValue = (key: string) => {
    return repreneur[key as keyof Repreneur]
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Tier 1 Answers</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {QUESTIONS.map((q) => (
            <div
              key={q.key}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0"
            >
              <span className="text-xs text-gray-600 flex-shrink-0 w-36 truncate" title={q.label}>
                {q.label}
              </span>
              <div className="flex-1 flex justify-end">
                {updatingField === q.key ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : q.type === "select" ? (
                  <SelectField
                    value={getValue(q.key) as string}
                    options={q.options}
                    onChange={(v) => handleUpdate(q.key, v)}
                    disabled={isPending}
                  />
                ) : q.type === "multiselect" ? (
                  <MultiSelectField
                    value={(getValue(q.key) as string[]) || []}
                    options={q.options}
                    onChange={(v) => handleUpdate(q.key, v)}
                    disabled={isPending}
                    searchable={q.searchable}
                  />
                ) : q.type === "boolean" ? (
                  <BooleanField
                    value={getValue(q.key) as boolean}
                    onChange={(v) => handleUpdate(q.key, v)}
                    disabled={isPending}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Select field component
function SelectField({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  options: readonly { value: string; label: string }[]
  onChange: (value: string | null) => void
  disabled: boolean
}) {
  return (
    <Select
      value={value || ""}
      onValueChange={(v) => onChange(v || null)}
      disabled={disabled}
    >
      <SelectTrigger className="h-7 text-xs w-40">
        <SelectValue placeholder="Sélectionner..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Multi-select field with optional search
function MultiSelectField({
  value,
  options,
  onChange,
  disabled,
  searchable = false,
}: {
  value: string[]
  options: readonly { value: string; label: string }[]
  onChange: (value: string[]) => void
  disabled: boolean
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)

  const toggleValue = (optValue: string) => {
    const newValue = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue]
    onChange(newValue)
  }

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-7 text-xs w-40 justify-between font-normal"
        >
          <span className="truncate">
            {value.length === 0
              ? "Sélectionner..."
              : value.length === 1
              ? selectedLabels[0]
              : `${value.length} sélectionnés`}
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          {searchable && options.length > 5 && (
            <CommandInput placeholder="Rechercher..." className="h-8 text-xs" />
          )}
          <CommandList className="max-h-48">
            <CommandEmpty className="text-xs py-2 text-center">Aucun résultat</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggleValue(opt.value)}
                  className="text-xs cursor-pointer"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                      value.includes(opt.value)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-gray-300"
                    )}
                  >
                    {value.includes(opt.value) && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Boolean field (Yes/No toggle)
function BooleanField({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null | undefined
  onChange: (value: boolean) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Non</span>
      <Switch
        checked={value === true}
        onCheckedChange={onChange}
        disabled={disabled}
        className="h-4 w-7"
      />
      <span className="text-xs text-gray-400">Oui</span>
    </div>
  )
}
