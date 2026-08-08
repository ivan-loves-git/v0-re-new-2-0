"use client"

import * as React from "react"
import { CircleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type FieldErrors = Record<string, string>

type Requirement = "required" | "optional" | "conditional"

interface FormFieldLabelProps extends React.ComponentProps<typeof Label> {
  requirement?: Requirement
  requirementText?: string
}

export function FormFieldLabel({
  children,
  className,
  requirement,
  requirementText,
  ...props
}: FormFieldLabelProps) {
  const text = requirementText ?? (
    requirement === "required"
      ? "Required"
      : requirement === "optional"
        ? "Optional"
        : requirement === "conditional"
          ? "Required for this step"
          : null
  )

  return (
    <Label className={cn("flex-wrap", className)} {...props}>
      <span>{children}</span>
      {text ? (
        <span
          className={cn(
            "text-[11px] font-medium",
            requirement === "required" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {text}
        </span>
      ) : null}
    </Label>
  )
}

export function fieldErrorId(fieldId: string) {
  return `${fieldId}-error`
}

export function fieldErrorProps(fieldId: string, message?: string, describedBy?: string) {
  const errorId = message ? fieldErrorId(fieldId) : undefined
  return {
    "aria-invalid": Boolean(message),
    "aria-describedby": [describedBy, errorId].filter(Boolean).join(" ") || undefined,
  } as const
}

export function FieldError({
  id,
  message,
  className,
}: {
  id: string
  message?: string
  className?: string
}) {
  if (!message) return null

  return (
    <p
      id={fieldErrorId(id)}
      role="alert"
      className={cn("flex items-start gap-1.5 text-xs text-destructive", className)}
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

interface ValidationSummaryProps {
  errors: FieldErrors
  labels: Record<string, string>
  targets?: Record<string, string>
  title?: string
  className?: string
}

export const ValidationSummary = React.forwardRef<HTMLDivElement, ValidationSummaryProps>(
  function ValidationSummary({ errors, labels, targets, title = "Check the highlighted fields", className }, ref) {
    const fields = Object.keys(errors).filter((field) => Boolean(errors[field]))
    if (fields.length === 0) return null

    return (
      <Alert
        ref={ref}
        variant="destructive"
        tabIndex={-1}
        className={cn("scroll-mt-24", className)}
      >
        <CircleAlert aria-hidden="true" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>
            Check {fields.length === 1 ? "this field" : `${fields.length} fields`}:{" "}
            {fields.map((field, index) => (
              <React.Fragment key={field}>
                {index > 0 ? index === fields.length - 1 ? " and " : ", " : null}
                <a className="font-medium underline underline-offset-2" href={`#${targets?.[field] ?? field}`}>
                  {labels[field] ?? field.replaceAll("_", " ")}
                </a>
              </React.Fragment>
            ))}
            .
          </p>
        </AlertDescription>
      </Alert>
    )
  },
)

export function focusValidationSummary(ref: React.RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => ref.current?.focus())
}
