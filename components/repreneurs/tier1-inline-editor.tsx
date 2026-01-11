"use client"

import { useState, useTransition } from "react"
import { Calculator, Check, ChevronDown, Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateTier1Answers } from "@/lib/actions/repreneurs"
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
    label: "Annees d'experience",
    type: "select" as const,
    options: YEARS_EXPERIENCE_OPTIONS,
  },
  {
    key: "q3_industry_sectors",
    label: "Secteurs d'experience",
    type: "multiselect" as const,
    options: INDUSTRY_SECTOR_OPTIONS,
    searchable: true,
  },
  {
    key: "q4_has_ma_experience",
    label: "Experience M&A",
    type: "boolean" as const,
  },
  {
    key: "q5_team_size",
    label: "Taille equipe geree",
    type: "select" as const,
    options: TEAM_SIZE_OPTIONS,
  },
  {
    key: "q6_involved_in_ma",
    label: "Implique dans M&A",
    type: "boolean" as const,
  },
  {
    key: "q8_executive_roles",
    label: "Roles executifs",
    type: "multiselect" as const,
    options: EXECUTIVE_ROLE_OPTIONS,
    searchable: true,
  },
  {
    key: "q9_board_experience",
    label: "Experience conseil",
    type: "boolean" as const,
  },
  {
    key: "q10_journey_stages",
    label: "Etape du parcours",
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
    label: "Cibles identifiees",
    type: "boolean" as const,
  },
  {
    key: "q14_investment_capacity",
    label: "Capacite d'investissement",
    type: "select" as const,
    options: INVESTMENT_CAPACITY_OPTIONS,
  },
  {
    key: "q15_funding_status",
    label: "Etat du financement",
    type: "select" as const,
    options: FUNDING_STATUS_OPTIONS,
  },
  {
    key: "q16_network_training",
    label: "Reseau / Formation",
    type: "multiselect" as const,
    options: NETWORK_TRAINING_OPTIONS,
  },
  {
    key: "q17_open_to_co_acquisition",
    label: "Ouvert co-acquisition",
    type: "boolean" as const,
  },
]

type LocalAnswers = Record<string, string | string[] | boolean | null>

export function Tier1InlineEditor({ repreneur }: Tier1InlineEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Initialize local state with current repreneur values
  const getInitialAnswers = (): LocalAnswers => {
    const answers: LocalAnswers = {}
    for (const q of QUESTIONS) {
      answers[q.key] = repreneur[q.key as keyof Repreneur] as string | string[] | boolean | null
    }
    return answers
  }

  const [localAnswers, setLocalAnswers] = useState<LocalAnswers>(getInitialAnswers)
  const [hasChanges, setHasChanges] = useState(false)

  // Reset local state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalAnswers(getInitialAnswers())
      setHasChanges(false)
    }
    setIsOpen(open)
  }

  // Update local state only (no server call)
  const handleLocalChange = (key: string, value: string | string[] | boolean | null) => {
    setLocalAnswers(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // Save all changes and recalculate score
  const handleCalculate = async () => {
    startTransition(async () => {
      try {
        await updateTier1Answers(repreneur.id, localAnswers)
        toast.success("Score calculated and saved")
        setIsOpen(false)
        setHasChanges(false)
      } catch (error) {
        toast.error("Failed to calculate score")
        console.error(error)
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
                {q.type === "select" ? (
                  <SelectField
                    value={localAnswers[q.key] as string}
                    options={q.options}
                    onChange={(v) => handleLocalChange(q.key, v)}
                  />
                ) : q.type === "multiselect" ? (
                  <MultiSelectField
                    value={(localAnswers[q.key] as string[]) || []}
                    options={q.options}
                    onChange={(v) => handleLocalChange(q.key, v)}
                    searchable={q.searchable}
                  />
                ) : q.type === "boolean" ? (
                  <BooleanField
                    value={localAnswers[q.key] as boolean}
                    onChange={(v) => handleLocalChange(q.key, v)}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button
            onClick={handleCalculate}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            {isPending ? "Calculating..." : "Calculate & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Select field component
function SelectField({
  value,
  options,
  onChange,
}: {
  value: string | null | undefined
  options: readonly { value: string; label: string }[]
  onChange: (value: string | null) => void
}) {
  return (
    <Select
      value={value || ""}
      onValueChange={(v) => onChange(v || null)}
    >
      <SelectTrigger className="h-7 text-xs w-40">
        <SelectValue placeholder="Select..." />
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
  searchable = false,
}: {
  value: string[]
  options: readonly { value: string; label: string }[]
  onChange: (value: string[]) => void
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
          className="h-7 text-xs w-40 justify-between font-normal"
        >
          <span className="truncate">
            {value.length === 0
              ? "Select..."
              : value.length === 1
              ? selectedLabels[0]
              : `${value.length} selected`}
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          {searchable && options.length > 5 && (
            <CommandInput placeholder="Search..." className="h-8 text-xs" />
          )}
          <CommandList className="max-h-48">
            <CommandEmpty className="text-xs py-2 text-center">No results</CommandEmpty>
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
}: {
  value: boolean | null | undefined
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">No</span>
      <Switch
        checked={value === true}
        onCheckedChange={onChange}
        className="h-4 w-7"
      />
      <span className="text-xs text-gray-400">Yes</span>
    </div>
  )
}
