"use client"

import { useRef } from "react"
import Link from "next/link"
import { Plus, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepreneurTable, type RepreneurTableRef } from "./repreneur-table"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
}

export function RepreneursGroupsPage({ repreneurs }: { repreneurs: RepreneurWithOffers[] }) {
  const tableRef = useRef<RepreneurTableRef>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Groups</h1>
          <p className="text-gray-600 mt-1">Repreneurs organized by lifecycle status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-400 hover:text-gray-600"
            onClick={() => tableRef.current?.triggerExport()}
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Link href="/repreneurs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Repreneur
            </Button>
          </Link>
        </div>
      </div>

      <RepreneurTable ref={tableRef} repreneurs={repreneurs} />
    </div>
  )
}
