"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setRepreneurDemoClassification } from "@/lib/actions/repreneurs"
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

type DemoClassificationResult = { success: boolean; message: string }

export function RepreneurDemoBadge() {
  return (
    <Badge variant="destructive">
      <FlaskConical />
      DEMO
    </Badge>
  )
}

export function RepreneurClassificationBadge({ isDemo }: { isDemo: boolean }) {
  return isDemo ? <RepreneurDemoBadge /> : <Badge variant="secondary">REAL</Badge>
}

/** Staff-only control. It changes no lifecycle, portal role or retained history. */
export function RepreneurDemoControl({
  repreneurId,
  isDemo,
  controlState,
}: {
  repreneurId: string
  isDemo: boolean
  controlState: DemoClassificationControlState
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nextIsDemo = !isDemo

  async function confirm() {
    setIsSubmitting(true)
    try {
      const result: DemoClassificationResult = await setRepreneurDemoClassification(
        repreneurId,
        nextIsDemo,
      )
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The DEMO classification could not be updated.")
    } finally {
      setIsSubmitting(false)
    }
  }

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
            <AlertDialogTitle>{nextIsDemo ? "Mark this repreneur DEMO?" : "Remove DEMO classification?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {nextIsDemo
                ? "This moves the profile into the DEMO-only workspace and excludes it from REAL recommendations and production reporting."
                : "This returns the profile to the REAL workspace, production reporting, and normal recommendation rules. Confirm that this is a real operating profile."}
            </AlertDialogDescription>
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
