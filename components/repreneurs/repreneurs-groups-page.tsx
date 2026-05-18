"use client"

import { useRef } from "react"
import Link from "next/link"
import { Download, FolderKanban, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
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
      <SectionPageHeader
        title="Groups"
        subtitle="Repreneurs organized by lifecycle status"
        icon={FolderKanban}
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

      <RepreneurTable ref={tableRef} repreneurs={repreneurs} />
    </div>
  )
}
