"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Check, AlertCircle } from "lucide-react"
import type { QuestionOption } from "./types"

// =====================
// YES/NO BUTTONS
// =====================

interface YesNoButtonsProps {
  value: boolean | null
  onChange: (value: boolean) => void
  showSkip?: boolean
  onSkip?: () => void
  variant?: "default" | "styled"
}

export function YesNoButtons({
  value,
  onChange,
  showSkip,
  onSkip,
  variant = "styled",
}: YesNoButtonsProps) {
  if (variant === "default") {
    // Simple inline buttons (internal questionnaire style)
    return (
      <div className="flex gap-4">
        <Button
          type="button"
          variant={value === true ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(true)}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={value === false ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(false)}
        >
          No
        </Button>
        {showSkip && onSkip && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
          >
            Skip
          </Button>
        )}
      </div>
    )
  }

  // Styled buttons (intake style)
  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant={value === true ? "default" : "outline"}
        className={cn(
          "flex-1 h-12 text-base transition-all",
          value === true && "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
        )}
        onClick={() => onChange(true)}
      >
        <Check className="h-5 w-5 mr-2" />
        Yes
      </Button>
      <Button
        type="button"
        variant={value === false ? "default" : "outline"}
        className={cn(
          "flex-1 h-12 text-base transition-all",
          value === false && "bg-slate-600 hover:bg-slate-700"
        )}
        onClick={() => onChange(false)}
      >
        No
      </Button>
    </div>
  )
}

// =====================
// RADIO OPTION GRID
// =====================

interface RadioOptionGridProps {
  value: string | null
  onChange: (value: string) => void
  options: readonly QuestionOption[] | QuestionOption[]
  variant?: "default" | "styled"
  columns?: 1 | 2 | 3
}

export function RadioOptionGrid({
  value,
  onChange,
  options,
  variant = "styled",
  columns = 2,
}: RadioOptionGridProps) {
  const gridClass = columns === 1
    ? "space-y-2"
    : columns === 3
      ? "grid sm:grid-cols-3 gap-3"
      : "grid sm:grid-cols-2 gap-3"

  if (variant === "default") {
    // Dropdown select (internal questionnaire style)
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Styled radio cards (intake style)
  return (
    <RadioGroup value={value ?? ""} onValueChange={onChange} className={gridClass}>
      {options.map((opt) => (
        <div
          key={opt.value}
          className={cn(
            "flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
            value === opt.value
              ? "border-blue-500 bg-blue-50"
              : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
          )}
          onClick={() => onChange(opt.value)}
        >
          <RadioGroupItem value={opt.value} id={`radio-${opt.value}`} />
          <Label htmlFor={`radio-${opt.value}`} className="cursor-pointer flex-1">
            {opt.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}

// =====================
// CHECKBOX GRID
// =====================

interface CheckboxGridProps {
  value: string[]
  onChange: (value: string[]) => void
  options: readonly QuestionOption[] | QuestionOption[]
  variant?: "default" | "styled"
  columns?: 1 | 2 | 3
  maxHeight?: string
}

export function CheckboxGrid({
  value,
  onChange,
  options,
  variant = "styled",
  columns = 2,
  maxHeight,
}: CheckboxGridProps) {
  const toggleValue = (optValue: string) => {
    const updated = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue]
    onChange(updated)
  }

  const gridClass = columns === 1
    ? "space-y-2"
    : columns === 3
      ? "grid sm:grid-cols-3 gap-2"
      : "grid sm:grid-cols-2 gap-2"

  const containerStyle = maxHeight
    ? { maxHeight, overflowY: "auto" as const }
    : undefined

  if (variant === "default") {
    // Simple checkbox list (internal questionnaire style)
    return (
      <div className={cn(gridClass, "border rounded-md p-3")} style={containerStyle}>
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <Checkbox
              id={`cb-${opt.value}`}
              checked={value.includes(opt.value)}
              onCheckedChange={() => toggleValue(opt.value)}
            />
            <label htmlFor={`cb-${opt.value}`} className="text-sm cursor-pointer">
              {opt.label}
            </label>
          </div>
        ))}
      </div>
    )
  }

  // Styled checkbox cards (intake style)
  return (
    <div className={cn(gridClass, "pr-2")} style={containerStyle}>
      {options.map((opt) => (
        <div
          key={opt.value}
          className={cn(
            "flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
            value.includes(opt.value)
              ? "border-blue-500 bg-blue-50"
              : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
          )}
          onClick={() => toggleValue(opt.value)}
        >
          <Checkbox
            checked={value.includes(opt.value)}
            className="pointer-events-none"
          />
          <span className="text-sm">{opt.label}</span>
        </div>
      ))}
    </div>
  )
}

// =====================
// TEXT INPUT WITH ERROR
// =====================

interface TextInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "email" | "tel" | "url"
  placeholder?: string
  error?: string
  required?: boolean
  icon?: React.ReactNode
  variant?: "default" | "styled"
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  required,
  icon,
  variant = "styled",
}: TextInputProps) {
  if (variant === "default") {
    // Simple input (internal style)
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(error && "border-red-500")}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  // Styled input (intake style)
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium flex items-center gap-2">
        {icon}
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-12 text-base transition-colors",
          error && "border-red-500 focus-visible:ring-red-500"
        )}
      />
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  )
}

// =====================
// TEXTAREA INPUT
// =====================

interface TextareaInputProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
  variant?: "default" | "styled"
}

export function TextareaInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required,
  variant = "styled",
}: TextareaInputProps) {
  if (variant === "default") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <Textarea
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-semibold block">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Textarea
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="resize-none"
      />
    </div>
  )
}

// =====================
// CONSENT CHECKBOX
// =====================

interface ConsentCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  required?: boolean
  variant?: "default" | "styled"
}

export function ConsentCheckbox({
  checked,
  onChange,
  label,
  description,
  required,
  variant = "styled",
}: ConsentCheckboxProps) {
  if (variant === "default") {
    return (
      <div className="flex items-start space-x-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
        />
        <div>
          <Label className="cursor-pointer">
            {label} {required && <span className="text-red-500">*</span>}
          </Label>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-start space-x-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
        checked
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-blue-300"
      )}
      onClick={() => onChange(!checked)}
    >
      <Checkbox
        checked={checked}
        className="mt-1 pointer-events-none"
      />
      <div>
        <Label className="font-semibold cursor-pointer">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </div>
    </div>
  )
}
