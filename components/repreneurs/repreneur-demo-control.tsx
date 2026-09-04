"use client"

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setRepreneurDemoClassification } from "@/lib/actions/repreneurs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}: {
  repreneurId: string
  isDemo: boolean
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

  return (
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
              ? "This retains the profile and its history for staff, while excluding it and its activity from production reporting and automatic matching."
              : "This returns the profile to normal reporting and matching rules. Confirm that this is a real operating profile."}
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
  )
}
