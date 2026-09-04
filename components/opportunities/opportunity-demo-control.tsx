"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DemoClassificationAuditLine,
  DemoClassificationLockNotice,
} from "@/components/demo-classification-control-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DemoClassificationControlState } from "@/lib/demo-classification"
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
import type { OpportunityActionResult } from "@/lib/types/opportunity"

export function OpportunityDemoBadge({ className }: { className?: string }) {
  return (
    <Badge className={className} variant="destructive">
      <FlaskConical />
      DEMO
    </Badge>
  )
}

export function OpportunityClassificationBadge({ isDemo, className }: { isDemo: boolean; className?: string }) {
  return isDemo ? <OpportunityDemoBadge className={className} /> : <Badge className={className} variant="secondary">REAL</Badge>
}

export function OpportunityDemoControl({
  isDemo,
  action,
  controlState,
}: {
  isDemo: boolean
  action: (isDemo: boolean) => Promise<OpportunityActionResult>
  controlState: DemoClassificationControlState
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nextIsDemo = !isDemo

  async function confirm() {
    setIsSubmitting(true)
    try {
      const result = await action(nextIsDemo)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    } catch (error) {
      console.error("Opportunity DEMO classification update failed")
      toast.error(
        error instanceof Error
          ? error.message
          : "The DEMO classification could not be updated.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = nextIsDemo
    ? "Mark this opportunity DEMO?"
    : "Remove DEMO classification?"
  const description = nextIsDemo
    ? "This moves the opportunity into DEMO-only Deal Flow, removes it from REAL discovery and production reporting, and keeps the record available to staff."
    : "This moves the opportunity into REAL Deal Flow and production reporting. If it is Active, it can become visible to REAL repreneurs under the normal lifecycle rule."

  if (controlState.lockReason) {
    return <DemoClassificationLockNotice state={controlState} />
  }

  return (
    <div className="space-y-1.5">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant={isDemo ? "destructive" : "outline"} size="sm">
            <FlaskConical data-icon="inline-start" />
            {isDemo ? "Remove DEMO" : "Mark DEMO"}
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
              {isSubmitting ? "Updating..." : nextIsDemo ? "Mark DEMO" : "Remove DEMO"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DemoClassificationAuditLine state={controlState} />
    </div>
  )
}
