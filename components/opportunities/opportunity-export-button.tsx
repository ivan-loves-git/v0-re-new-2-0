"use client"

import { useTransition } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { listOpportunityExportRows } from "@/lib/actions/opportunity-export"
import { opportunityExportRowsToCsv } from "@/lib/utils/opportunity-export"

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "wave-opportunities.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export function OpportunityExportButton() {
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    startTransition(async () => {
      try {
        downloadCsv(opportunityExportRowsToCsv(await listOpportunityExportRows()))
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
