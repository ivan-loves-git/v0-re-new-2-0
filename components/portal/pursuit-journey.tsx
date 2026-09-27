"use client"

import { useRef, useState } from "react"
import { ArrowRight, Check, Circle, CircleDot, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { WaveMicroLabel } from "@/components/wave/visual-foundations"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"
import { displayLocale } from "@/lib/i18n/ui-language"
import { buildPortalJourneyView, type JourneyStepState, type PortalJourneyViewStep } from "@/lib/portal-pursuit-journey"
import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"
import { cn } from "@/lib/utils"

type JourneyOpportunity = Pick<RepreneurDealFlowOpportunity,
  "match_status" | "pursuit_stage" | "pursuit_stage_provenance" | "interest_expressed_at" | "interest_rejected">

function useJourneyWords() {
  const copy = useUiCopy()
  const language = useUiLanguage()
  const stateLabel = (state: JourneyStepState) => {
    switch (state) {
      case "recorded": return copy("Recorded")
      case "current": return copy("Current state")
      case "unknown": return copy("Not established here")
      case "future": return copy("Future step")
      case "outcome": return copy("Outcome")
    }
  }
  const dateLabel = (date: string | null) => {
    if (!date || Number.isNaN(new Date(date).getTime())) return copy("Date not recorded")
    return new Intl.DateTimeFormat(displayLocale(language), { day: "numeric", month: "short", year: "numeric" }).format(new Date(date))
  }
  const description = (step: PortalJourneyViewStep, opportunity: JourneyOpportunity, pursuit: PortalCurrentPursuit | null) => {
    if (step.key === "response" && step.state === "outcome") return copy("This outcome is distinct from an active pursuit.")
    if (step.key === "response" && opportunity.match_status === "interested" && !opportunity.interest_rejected) return copy("The response is awaiting Re-New validation.")
    if (step.key === "nda_ready" && pursuit?.action === "sign_nda") return `${copy(step.explanation)} ${copy("The next action is in Documents.")}`
    if (step.key === "memo" && step.state === "outcome") return opportunity.pursuit_stage === "info_memo_received"
      ? copy("The IM remains the current business stage, but access to the exact document has ended.")
      : copy("The current IM permission ended; previously visible files are not available here.")
    if (step.key === "memo" && opportunity.pursuit_stage === "info_memo_received" && !pursuit?.confidentialGrant) return copy("The IM stage is recorded, but this view has no current permission to open the document.")
    if (step.state === "current" && opportunity.pursuit_stage_provenance === "staff_confirmed_history" &&
      ["confirmed", "nda_signed", "memo", "qa", "intermediary", "seller", "loi"].includes(step.key)) {
      return `${copy(step.explanation)} ${copy("Staff-confirmed historical stage. Its date and prior steps are not inferred.")}`
    }
    return copy(step.explanation)
  }
  return { copy, stateLabel, dateLabel, description }
}

function outcomeLabel(opportunity: JourneyOpportunity, copy: ReturnType<typeof useUiCopy>) {
  if (opportunity.match_status === "withdrawn") return copy("Interest withdrawn")
  if (opportunity.match_status === "interested" && opportunity.interest_rejected) return copy("Interest not selected")
  if (opportunity.match_status === "declined") return copy("Opportunity declined")
  if (opportunity.match_status === "dropped") return copy("Pursuit ended")
  return null
}

export function PursuitJourneyProgress({ opportunity, pursuit, onFullHistory }: {
  opportunity: JourneyOpportunity
  pursuit: PortalCurrentPursuit | null
  onFullHistory: () => void
}) {
  const { copy, stateLabel, dateLabel, description } = useJourneyWords()
  const steps = buildPortalJourneyView(opportunity, pursuit)
  const [openStep, setOpenStep] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerOpening = useRef(false)
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current) }
  const queueClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpenStep(null), 160) }
  const pointerDown = () => { pointerOpening.current = true; setTimeout(() => { pointerOpening.current = false }, 0) }
  const focusOpen = (key: string) => { if (!pointerOpening.current) setOpenStep(key) }
  const recorded = steps.filter((step) => step.state === "recorded").length
  const phases = [
    { key: "interest", label: "Interest" }, { key: "confidentiality", label: "NDA & memo" },
    { key: "assessment", label: "Assessment" }, { key: "transaction", label: "Transaction" },
  ] as const
  const segmentTone = (state: JourneyStepState) => cn("block h-1.5 w-full rounded-[2px]", state === "recorded" && "bg-primary", state === "current" && "border border-primary bg-background", state === "unknown" && "bg-muted-foreground/25", state === "future" && "bg-muted-foreground/20", state === "outcome" && "bg-amber-500")
  return <section className="min-w-0" aria-label={copy("Journey")} data-wave-progress>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
      <div className="flex items-center gap-2"><span className="font-semibold text-foreground">{copy("Journey")}</span><span className="text-muted-foreground">{copy("Recorded milestones: {count}", { count: recorded })}</span></div>
      <Button variant="link" size="sm" className="h-9 px-0 text-xs font-semibold" onClick={onFullHistory}>{copy("Full history")}<ArrowRight data-icon="inline-end" /></Button>
    </div>
    <div className="hidden gap-1 xl:flex" role="group" aria-label={copy("Journey")}>
      {steps.map((step) => <Popover key={step.key} open={openStep === step.key} onOpenChange={(open) => setOpenStep(open ? step.key : null)}>
        <PopoverTrigger asChild>
          <button type="button" className={cn("flex h-11 min-w-11 flex-1 items-center rounded-sm border-0 p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", step.state === "current" && "bg-primary/15", step.state === "outcome" && "bg-amber-100 dark:bg-amber-950")} aria-label={`${copy(step.label)}: ${stateLabel(step.state)}`} onPointerEnter={(event) => { if (event.pointerType === "mouse") { cancelClose(); setOpenStep(step.key) } }} onPointerLeave={(event) => { if (event.pointerType === "mouse") queueClose() }} onPointerDown={pointerDown} onFocus={() => focusOpen(step.key)} onClick={(event) => { if (openStep === step.key) event.preventDefault() }}>
            <span className={segmentTone(step.state)} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[min(19rem,calc(100vw-2rem))] p-4" onOpenAutoFocus={(event) => event.preventDefault()} onMouseEnter={cancelClose} onMouseLeave={queueClose}>
          <p className="text-sm font-semibold">{copy(step.label)}</p>
          <p className="mt-1 text-xs font-medium text-primary">{stateLabel(step.state)} · {dateLabel(step.date)}</p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{description(step, opportunity, pursuit)}</p>
          <Button size="sm" variant="link" className="mt-2 h-9 px-0" onClick={() => { setOpenStep(null); onFullHistory() }}>{copy("Full history")}<ArrowRight data-icon="inline-end" /></Button>
        </PopoverContent>
      </Popover>)}
    </div>
    <div className="mt-1 hidden grid-cols-[3fr_4fr_4fr_4fr] gap-1 text-xs leading-4 text-muted-foreground xl:grid">
      {phases.map((phase) => <span key={phase.key} className="min-w-0 wrap-break-word">{copy(phase.label)}</span>)}
    </div>
    <div className="xl:hidden">
      <div className="flex gap-1 py-2" aria-hidden="true">{steps.map((step) => <span key={step.key} className={segmentTone(step.state)} />)}</div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label={copy("Journey")}>
        {phases.map((phase) => <Popover key={phase.key} open={openStep === `phase-${phase.key}`} onOpenChange={(open) => setOpenStep(open ? `phase-${phase.key}` : null)}>
          <PopoverTrigger asChild><button type="button" className="min-h-11 min-w-0 rounded-md px-1 py-2 text-left text-[11px] leading-4 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`${copy(phase.label)}: ${copy("Journey")}`} onPointerDown={pointerDown} onFocus={() => focusOpen(`phase-${phase.key}`)} onClick={(event) => { if (openStep === `phase-${phase.key}`) event.preventDefault() }}>{copy(phase.label)}</button></PopoverTrigger>
          <PopoverContent align="center" className="max-h-[70svh] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto p-4" onOpenAutoFocus={(event) => event.preventDefault()}>
            <p className="text-sm font-semibold">{copy(phase.label)}</p>
            <div className="mt-2 divide-y">{steps.filter((step) => step.phase === phase.key).map((step) => <div key={step.key} className="py-3"><p className="text-sm font-medium">{copy(step.label)}</p><p className="mt-1 text-xs text-primary">{stateLabel(step.state)} · {dateLabel(step.date)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description(step, opportunity, pursuit)}</p></div>)}</div>
            <Button size="sm" variant="link" className="mt-2 h-11 px-0" onClick={() => { setOpenStep(null); onFullHistory() }}>{copy("Full history")}<ArrowRight data-icon="inline-end" /></Button>
          </PopoverContent>
        </Popover>)}
      </div>
    </div>
  </section>
}

function JourneyRow({ step, opportunity, pursuit }: {
  step: PortalJourneyViewStep
  opportunity: JourneyOpportunity
  pursuit: PortalCurrentPursuit | null
}) {
  const { copy, stateLabel, dateLabel, description } = useJourneyWords()
  return <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-b px-4 py-5 last:border-0 sm:grid-cols-[6.5rem_1.25rem_minmax(0,1fr)] sm:px-6">
    <span className="hidden pt-0.5 text-xs text-muted-foreground sm:block">{dateLabel(step.date)}</span>
    <span className={cn("mt-0.5 grid size-5 place-items-center rounded-full text-xs", step.state === "recorded" && "bg-primary text-primary-foreground", step.state === "current" && "border-2 border-primary text-primary", step.state === "outcome" && "bg-amber-100 text-amber-700 dark:bg-amber-950", (step.state === "unknown" || step.state === "future") && "border bg-muted text-muted-foreground")} aria-hidden="true">
      {step.state === "recorded" ? <Check className="size-3" /> : step.state === "current" ? <CircleDot className="size-3" /> : step.state === "unknown" ? <HelpCircle className="size-3" /> : <Circle className="size-3" />}
    </span>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{copy(step.label)}</h3><span className={cn("rounded border px-1.5 py-0.5 text-[10px]", step.state === "current" && "border-primary/40 bg-primary/5 text-primary")}>{stateLabel(step.state)}</span></div>
      <p className="mt-1 text-xs text-muted-foreground sm:hidden">{dateLabel(step.date)}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description(step, opportunity, pursuit)}</p>
      {step.role ? <p className="mt-2 text-xs text-muted-foreground">{copy("Re-New")}</p> : null}
    </div>
  </li>
}

export function PursuitJourneyHistory({ opportunity, pursuit }: {
  opportunity: JourneyOpportunity
  pursuit: PortalCurrentPursuit | null
}) {
  const { copy } = useJourneyWords()
  const steps = buildPortalJourneyView(opportunity, pursuit)
  const outcome = outcomeLabel(opportunity, copy)
  return <section id="journey-view" className="overflow-hidden rounded-lg border bg-card" aria-label={copy("Journey & history")} data-wave-journey>
    <div className="border-b p-5 sm:p-6"><h2 className="font-semibold">{copy("Journey & history")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy("Dates appear only when a safe record exists. Business stages and document access follow separate checks.")}</p>
      {pursuit?.projectionUnavailable ? <p role="status" className="mt-3 rounded-md border bg-muted p-3 text-sm">{copy("The detailed record is unavailable right now. Current business stage information may still appear.")}</p> : null}
      {pursuit?.history.previousCycleEnded ? <p className="mt-3 rounded-md border bg-muted p-3 text-sm">{copy("A previous pursuit cycle ended. Its documents and permissions do not carry into this cycle.")}</p> : null}
      {opportunity.match_status === "active_pursuit" && pursuit && !pursuit.projectionUnavailable && !pursuit.history.currentCycleRecorded ? <p className="mt-3 rounded-md border bg-muted p-3 text-sm">{copy("Current cycle history is incomplete; missing steps have no assumed date or completion.")}</p> : null}
      {outcome ? <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950"><strong>{outcome}.</strong> {copy("This outcome is distinct from an active pursuit.")}</p> : null}
    </div>
    <div><WaveMicroLabel asChild className="border-b bg-muted/30 px-5 py-3 text-muted-foreground"><h3>{copy("Stages and available records")}</h3></WaveMicroLabel><ol>{steps.map((step) => <JourneyRow key={step.key} step={step} opportunity={opportunity} pursuit={pursuit} />)}</ol></div>
  </section>
}
