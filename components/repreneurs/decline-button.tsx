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
import type { LifecycleStatus } from "@/lib/types/repreneur"

interface DeclineButtonProps {
  repreneurId: string
  currentStatus: LifecycleStatus
  repreneurName: string
}

export function DeclineButton({ repreneurId, currentStatus, repreneurName }: DeclineButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isDeclined = currentStatus === "declined"

  async function handleDecline() {
    setIsLoading(true)
    try {
      await declineRepreneur(repreneurId)
      setIsOpen(false)
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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Undo className="h-4 w-4" />
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
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-gray-600 hover:text-gray-700">
          <XCircle className="h-4 w-4" />
          Decline
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Repreneur</DialogTitle>
          <DialogDescription>
            Are you sure you want to decline {repreneurName}? This is an internal decision and no email will be sent.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleDecline} disabled={isLoading}>
            {isLoading ? "Declining..." : "Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
