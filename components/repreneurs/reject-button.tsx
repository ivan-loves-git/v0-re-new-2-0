"use client"

import { useState } from "react"
import { Ban, Undo } from "lucide-react"
import { rejectRepreneur, unrejectRepreneur } from "@/lib/actions/repreneurs"
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

interface RejectButtonProps {
  repreneurId: string
  currentStatus: LifecycleStatus
  repreneurName: string
}

export function RejectButton({ repreneurId, currentStatus, repreneurName }: RejectButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isRejected = currentStatus === "rejected"

  async function handleReject() {
    setIsLoading(true)
    try {
      await rejectRepreneur(repreneurId)
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to reject repreneur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUnreject() {
    setIsLoading(true)
    try {
      await unrejectRepreneur(repreneurId)
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to un-reject repreneur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isRejected) {
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
            <Button onClick={handleUnreject} disabled={isLoading}>
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
        <Button variant="destructive" size="sm" className="gap-2">
          <Ban className="h-4 w-4" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Repreneur</DialogTitle>
          <DialogDescription>
            Are you sure you want to reject {repreneurName}? This action can be reversed later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
            {isLoading ? "Rejecting..." : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
