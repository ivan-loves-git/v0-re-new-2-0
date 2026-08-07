"use client"

import { useTransition } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { listOpportunityExportRows } from "@/lib/actions/opportunity-export"
import { opportunityExportRowsToCsv } from "@/lib/utils/opportunity-export"

export function downloadOpportunityCsv(csv: string) {
  // Excel otherwise assumes a legacy encoding for a downloaded CSV on some
  // staff devices. Keep the BOM in the downloaded file, not the server data.
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "wave-opportunities.csv"
  link.click()
  // Revoking in the same task can cancel a download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function OpportunityExportButton() {
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    startTransition(async () => {
      try {
        downloadOpportunityCsv(opportunityExportRowsToCsv(await listOpportunityExportRows()))
      } catch {
        toast.error("The opportunity export is unavailable. Please try again.")
      }
    })
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={isPending}>
      <Download data-icon="inline-start" />
      {isPending ? "Preparing export…" : "Export CSV"}
    </Button>
  )
}
