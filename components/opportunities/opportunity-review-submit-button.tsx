"use client"

import type { ComponentProps } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

interface OpportunityReviewSubmitButtonProps extends ComponentProps<typeof Button> {
  label: string
  pendingLabel: string
}

export function OpportunityReviewSubmitButton({
  label,
  pendingLabel,
  children,
  disabled,
  ...props
}: OpportunityReviewSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {children}
      {pending ? pendingLabel : label}
    </Button>
  )
}
