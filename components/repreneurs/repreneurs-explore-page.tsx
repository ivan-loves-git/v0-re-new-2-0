"use client"

import { useRef } from "react"
import Link from "next/link"
import { Download, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { RepreneurExploreTable, type RepreneurExploreTableRef } from "./repreneur-explore-table"
import type { Repreneur } from "@/lib/types/repreneur"

export function RepreneursExplorePage({ repreneurs }: { repreneurs: Repreneur[] }) {
  const tableRef = useRef<RepreneurExploreTableRef>(null)

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Find"
        subtitle="Filter, sort, and find repreneurs across the full pipeline"
        icon={Search}
        tone="repreneur"
        actions={
          <>
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
          </>
        }
      />

      <RepreneurExploreTable ref={tableRef} repreneurs={repreneurs} />
    </div>
  )
}
