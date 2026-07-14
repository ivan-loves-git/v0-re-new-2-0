"use client"

import { useState } from "react"
import { XCircle, Undo } from "lucide-react"
import { declineRepreneur, undeclineRepreneur } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DECLINE_REASON_OPTIONS, type LifecycleStatus, type DeclineReasonCategory } from "@/lib/types/repreneur"

interface DeclineButtonProps {
  repreneurId: string
  currentStatus: LifecycleStatus
  repreneurName: string
  declineReasonCategory?: string
  declineReasonText?: string
}

export function DeclineButton({ repreneurId, currentStatus, repreneurName, declineReasonCategory, declineReasonText }: DeclineButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reasonCategory, setReasonCategory] = useState<string>("")
  const [reasonText, setReasonText] = useState("")

  const isDeclined = currentStatus === "declined"

  async function handleDecline() {
    setIsLoading(true)
    try {
      await declineRepreneur(repreneurId, reasonCategory || undefined, reasonText || undefined)
      setIsOpen(false)
      setReasonCategory("")
      setReasonText("")
    } catch (error) {
      console.error("Failed to decline repreneur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUndecline() {
    setIsLoading(true)
    try {
      await undeclineRepreneur(repreneurId)
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to restore repreneur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Don't show if already rejected (use RejectButton restore instead)
  if (currentStatus === "rejected") {
    return null
  }

  if (isDeclined) {
    return (
      <div className="space-y-2">
        {/* Show decline reason if available */}
        {declineReasonCategory && (
          <div className="rounded-md bg-muted/40 border px-3 py-2 text-sm">
            <p className="wave-micro-label mb-1">Decline reason</p>
            <p className="font-medium">{DECLINE_REASON_OPTIONS.find(o => o.value === declineReasonCategory)?.label || declineReasonCategory}</p>
            {declineReasonText && <p className="text-muted-foreground mt-0.5">{declineReasonText}</p>}
          </div>
        )}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Undo className="size-4" />
              Restore
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Repreneur</DialogTitle>
              <DialogDescription>
                Are you sure you want to restore {repreneurName}? They will be returned to their previous status.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUndecline} disabled={isLoading}>
                {isLoading ? "Restoring..." : "Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <XCircle className="size-4" />
          Decline
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Repreneur</DialogTitle>
          <DialogDescription>
            Mark {repreneurName} as declined. This is an internal decision — no email will be sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason</Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger id="decline-reason">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {DECLINE_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="decline-details">
              Details {reasonCategory === "other" ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="decline-details"
              placeholder="Additional context..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleDecline}
            disabled={isLoading || (reasonCategory === "other" && !reasonText.trim())}
          >
            {isLoading ? "Declining..." : "Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
