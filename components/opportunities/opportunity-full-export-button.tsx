"use client"

import { useRef, useState, useTransition } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { exportFullOpportunityCsv } from "@/lib/actions/opportunity-full-export"
import { downloadOpportunityCsv } from "@/components/opportunities/opportunity-export-button"

export function OpportunityFullExportButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inFlight = useRef(false)

  function confirmExport() {
    if (inFlight.current) return
    inFlight.current = true
    startTransition(async () => {
      try {
        const result = await exportFullOpportunityCsv(true)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        downloadOpportunityCsv(result.csv, result.filename)
        setOpen(false)
        toast.success(
          "Full export downloaded. Keep this confidential file secure.",
        )
      } catch {
        toast.error(
          "The full export is unavailable. No file was downloaded. Please try again.",
        )
      } finally {
        inFlight.current = false
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!inFlight.current) setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download data-icon="inline-start" />
          Full export
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!isPending}
      >
        <DialogHeader>
          <DialogTitle>Full opportunity &amp; pursuit export</DialogTitle>
          <DialogDescription>
            Download a confidential staff CSV containing all opportunity fields
            and their recorded pursuit data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Includes all statuses, archived records, and both REAL and DEMO
            data, regardless of the current page filters. Source contacts,
            repreneur contact details and internal notes are included.
          </p>
          <p>
            One row per opportunity–repreneur pair. Opportunities without a
            match are included too. Recorded histories, NDA evidence and
            document metadata are grouped in JSON cells.
          </p>
          <p>
            Document files, private download links and technical secrets are not
            included. Nothing in WAVE will be changed.
          </p>
          <p>Keep this file secure and share it only with authorised staff.</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={confirmExport} disabled={isPending}>
            <Download data-icon="inline-start" />
            {isPending ? "Preparing full export…" : "Download full CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
