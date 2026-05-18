"use client"

import { useRef } from "react"
import Link from "next/link"
import { Plus, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepreneurTable, type RepreneurTableRef } from "./repreneur-table"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
  assessment_decision?: string | null
  assessment_pending?: boolean
  has_scheduled_interview?: boolean
}

export function RepreneursGroupsPage({ repreneurs }: { repreneurs: RepreneurWithOffers[] }) {
  const tableRef = useRef<RepreneurTableRef>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Repreneurs organized by lifecycle status</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => tableRef.current?.triggerExport()}
            title="Export CSV"
            aria-label="Export repreneurs CSV"
          >
            <Download data-icon="inline-start" />
          </Button>
          <Button asChild>
            <Link href="/repreneurs/new">
              <Plus data-icon="inline-start" />
              Add Repreneur
            </Link>
          </Button>
        </div>
      </div>

      <RepreneurTable ref={tableRef} repreneurs={repreneurs} />
    </div>
  )
}
