"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  filterStaffReNewPursuits,
  sortStaffReNewPursuits,
  getReNewBoardStageLabel,
  RENEW_BOARD_COLUMNS,
  RENEW_BOARD_STAGES,
  RENEW_BOARD_SORTS,
  RENEW_BOARD_VIEWS,
  type ReNewBoardStage,
  type ReNewBoardSort,
  type ReNewBoardView,
  type ReNewStaffBoardRecord,
} from "@/lib/utils/renew-pursuit-board"

export function ReNewPursuitBoard({ records }: { records: ReNewStaffBoardRecord[] }) {
  const [view, setView] = useState<ReNewBoardView>("active")
  const [stage, setStage] = useState<ReNewBoardStage | "all">("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<ReNewBoardSort>("stage")
  const filtered = sortStaffReNewPursuits(filterStaffReNewPursuits(records, { view, stage, query }), sort)
  const viewRecords = records.filter((record) => record.view === view)
  const stageOptions = RENEW_BOARD_STAGES.filter((option) => viewRecords.some((record) => record.stage === option.value))

  function changeView(nextView: ReNewBoardView) {
    setView(nextView)
    setStage("all")
  }

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-muted-foreground">Each card follows one repreneur and one opportunity. Open the opportunity to review or act on the pursuit.</p>
      <div role="group" aria-label="Re-New pursuit views" className="flex flex-wrap gap-2">
        {RENEW_BOARD_VIEWS.map((option) => (
          <Button key={option.value} variant={view === option.value ? "secondary" : "outline"} aria-pressed={view === option.value} onClick={() => changeView(option.value)}>
            {option.label} <span className="text-muted-foreground">{records.filter((record) => record.view === option.value).length}</span>
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full space-y-1.5 sm:max-w-sm">
          <Label htmlFor="renew-pursuit-search">Search</Label>
          <Input id="renew-pursuit-search" placeholder="Repreneur or opportunity" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="w-full space-y-1.5 sm:w-64">
          <Label htmlFor="renew-pursuit-stage">Exact stage</Label>
          <Select value={stage} onValueChange={(value) => setStage(value as ReNewBoardStage | "all")}>
            <SelectTrigger id="renew-pursuit-stage" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stageOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1.5 sm:w-56">
          <Label htmlFor="renew-pursuit-sort">Sort by</Label>
          <Select value={sort} onValueChange={(value) => setSort(value as ReNewBoardSort)}>
            <SelectTrigger id="renew-pursuit-sort" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RENEW_BOARD_SORTS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(query || stage !== "all") && <Button variant="ghost" onClick={() => { setQuery(""); setStage("all") }}>Clear filters</Button>}
      </div>
      <p role="status" className="text-sm text-muted-foreground">Showing {filtered.length} of {viewRecords.length} pursuits in this view</p>
      {view === "active" ? (
        <section aria-label="Re-New active pursuit board" className="grid min-w-0 gap-4 xl:grid-cols-5">
          {RENEW_BOARD_COLUMNS.map((column) => {
            const cards = filtered.filter((record) => record.column === column.value)
            return (
              <Card key={column.value} className="min-w-0 gap-0 overflow-hidden py-0 shadow-none">
                <CardHeader className="gap-1 border-b px-3 py-3">
                  <CardTitle className="text-sm">{column.label}</CardTitle>
                  <CardDescription>{cards.length} pursuit{cards.length === 1 ? "" : "s"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3">
                  {cards.length ? cards.map((record) => <ReNewPursuitCard key={record.id} record={record} />) : <p className="py-3 text-sm text-muted-foreground">No pursuits</p>}
                </CardContent>
              </Card>
            )
          })}
        </section>
      ) : (
        <section aria-label={RENEW_BOARD_VIEWS.find((option) => option.value === view)?.label} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.length ? filtered.map((record) => <ReNewPursuitCard key={record.id} record={record} />) : <p className="py-6 text-sm text-muted-foreground">No pursuits in this view match your filters.</p>}
        </section>
      )}
    </div>
  )
}

function ReNewPursuitCard({ record }: { record: ReNewStaffBoardRecord }) {
  return (
    <article aria-label={`${record.ownerName || "Repreneur unavailable"} · ${record.title}`} className="min-w-0 space-y-3 rounded-lg border bg-background p-3">
      <div className="space-y-1 break-words">
        <p className="text-sm text-muted-foreground">{record.ownerName || "Repreneur unavailable"}</p>
        <h3 className="text-sm font-medium"><Link href={record.href} className="underline-offset-4 hover:underline focus-visible:underline">{record.title}</Link></h3>
      </div>
      <p className="text-sm font-medium">Stage: {getReNewBoardStageLabel(record.stage)}</p>
      {record.context && <p className="text-sm text-muted-foreground">{record.context}</p>}
      {record.stageProvenance === "staff_confirmed_history" && (
        <div className="space-y-1.5">
          <Badge variant="outline" className="whitespace-normal">Stage confirmed by Re-New</Badge>
          <p className="text-xs text-muted-foreground">Historical progress; milestone date unknown. Document access is checked separately.</p>
        </div>
      )}
    </article>
  )
}
