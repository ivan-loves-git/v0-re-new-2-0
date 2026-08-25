"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { broadDiscoveryPublicationState } from "@/lib/opportunity-broad-discovery-publication"
import type { Opportunity, OpportunityActionResult } from "@/lib/types/opportunity"

function incompleteDescription(missingFields: string[]) {
  return `Add ${missingFields.join(", ")} before this opportunity can be made visible in Deal Flow.`
}

export function OpportunityBroadDiscoveryControl({
  opportunity,
  action,
}: {
  opportunity: Pick<
    Opportunity,
    | "status"
    | "is_demo"
    | "repreneur_exposure"
    | "public_title"
    | "teaser_summary"
    | "sector"
    | "location"
  >
  action: (visible: boolean) => Promise<OpportunityActionResult>
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const state = broadDiscoveryPublicationState(opportunity)

  if (state.mode === "unavailable") return null

  if (state.mode === "incomplete") {
    return (
      <div className="flex max-w-72 flex-col gap-1">
        <Button type="button" variant="outline" size="sm" disabled>
          <Eye data-icon="inline-start" />
          Make visible in Deal Flow
        </Button>
        <p className="text-xs leading-4 text-muted-foreground">
          {incompleteDescription(state.missingFields)}
        </p>
      </div>
    )
  }

  const isPublishing = state.mode === "publish"
  const nextVisible = isPublishing
  const title = isPublishing
    ? "Make this opportunity visible in Deal Flow?"
    : "Remove this opportunity from Deal Flow?"
  const description = isPublishing
    ? "Only the anonymized teaser is exposed in Deal Flow. Staff-only source, contact, document, recommendation and pursuit details remain private."
    : "This removes the opportunity from broad Deal Flow discovery. Existing staff recommendations and pursuits are retained unchanged."
  const label = isPublishing
    ? "Make visible in Deal Flow"
    : "Remove from Deal Flow"

  async function confirm() {
    setIsSubmitting(true)
    try {
      const result = await action(nextVisible)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    } catch (error) {
      console.error("Opportunity broad discovery visibility update failed")
      toast.error(
        error instanceof Error
          ? error.message
          : "Deal Flow visibility could not be updated.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={isPublishing ? "default" : "outline"} size="sm">
          {isPublishing ? <Eye data-icon="inline-start" /> : <EyeOff data-icon="inline-start" />}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isSubmitting} onClick={() => void confirm()}>
            {isSubmitting ? "Updating..." : label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
