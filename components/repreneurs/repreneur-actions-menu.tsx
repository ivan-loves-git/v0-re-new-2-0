"use client"

import { useState } from "react"
import { toast } from "sonner"
import { MoreVertical, Ban, Undo, XCircle, Trash2 } from "lucide-react"
import { rejectRepreneur, unrejectRepreneur, declineRepreneur, undeclineRepreneur, deleteRepreneur } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { LifecycleStatus } from "@/lib/types/repreneur"

interface RepreneurActionsMenuProps {
  repreneurId: string
  currentStatus: LifecycleStatus
  repreneurName: string
}

export function RepreneurActionsMenu({ repreneurId, currentStatus, repreneurName }: RepreneurActionsMenuProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isRejected = currentStatus === "rejected"
  const isDeclined = currentStatus === "declined"

  async function handleReject() {
    setIsLoading(true)
    try {
      await rejectRepreneur(repreneurId)
      setIsRejectDialogOpen(false)
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
      setIsRejectDialogOpen(false)
    } catch (error) {
      console.error("Failed to restore repreneur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDecline() {
    setIsLoading(true)
    try {
      await declineRepreneur(repreneurId)
      setIsDeclineDialogOpen(false)
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
      setIsDeclineDialogOpen(false)
    } catch (error) {
      console.error("Failed to restore repreneur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    setIsLoading(true)
    try {
      await deleteRepreneur(repreneurId)
    } catch (error) {
      // deleteRepreneur calls redirect() which throws NEXT_REDIRECT - that's expected
      const message = error instanceof Error ? error.message : ""
      if (!message.includes("NEXT_REDIRECT")) {
        console.error("Failed to delete repreneur:", error)
        toast.error("Failed to delete repreneur. Please try again.")
        setIsLoading(false)
      }
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isRejected ? (
            <DropdownMenuItem onClick={() => setIsRejectDialogOpen(true)}>
              <Undo className="h-4 w-4 mr-2" />
              Restore from Rejected
            </DropdownMenuItem>
          ) : isDeclined ? (
            <DropdownMenuItem onClick={() => setIsDeclineDialogOpen(true)}>
              <Undo className="h-4 w-4 mr-2" />
              Restore from Declined
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => setIsDeclineDialogOpen(true)}
                className="text-gray-600"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline (no email)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsRejectDialogOpen(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Ban className="h-4 w-4 mr-2" />
                Reject (sends email)
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRejected ? "Restore Repreneur" : "Reject Repreneur"}</DialogTitle>
            <DialogDescription>
              {isRejected
                ? `Are you sure you want to restore ${repreneurName}? They will be returned to their previous status.`
                : `Are you sure you want to reject ${repreneurName}? A rejection email will be sent to the candidate.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            {isRejected ? (
              <Button onClick={handleUnreject} disabled={isLoading}>
                {isLoading ? "Restoring..." : "Restore"}
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
                {isLoading ? "Rejecting..." : "Reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isDeclined ? "Restore Repreneur" : "Decline Repreneur"}</DialogTitle>
            <DialogDescription>
              {isDeclined
                ? `Are you sure you want to restore ${repreneurName}? They will be returned to their previous status.`
                : `Are you sure you want to decline ${repreneurName}? This is an internal decision and no email will be sent.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeclineDialogOpen(false)}>
              Cancel
            </Button>
            {isDeclined ? (
              <Button onClick={handleUndecline} disabled={isLoading}>
                {isLoading ? "Restoring..." : "Restore"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleDecline} disabled={isLoading}>
                {isLoading ? "Declining..." : "Decline"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Repreneur Permanently</DialogTitle>
            <DialogDescription>
              This will permanently delete {repreneurName} and all their data (notes, activities, offers). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
