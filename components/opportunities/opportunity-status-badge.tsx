import { Badge } from "@/components/ui/badge"
import type React from "react"
import { Archive, CheckCircle2, CirclePause, Eye, EyeOff, FileText, Handshake, Inbox, MessageCircle, Pencil, Send, XCircle } from "lucide-react"
import {
  getOpportunityStatusLabel,
  getOpportunityVisibilityLabel,
  type OpportunityStatus,
  type OpportunityVisibility,
} from "@/lib/types/opportunity"
import { getOpportunityJourneyLabel, type OpportunityJourney } from "@/lib/utils/opportunity-journey"

export function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  const className: Record<OpportunityStatus, string> = {
    draft: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100",
    active: "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100",
    paused: "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100",
    archived: "border-transparent bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    closed: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  }

  return <Badge className={className[status]}>{getOpportunityStatusLabel(status)}</Badge>
}

export function OpportunityVisibilityBadge({ visibility }: { visibility: OpportunityVisibility }) {
  const className: Record<OpportunityVisibility, string> = {
    staff_only: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100",
    anonymized: "border-transparent bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
    repreneur_visible: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  }

  const Icon = visibility === "repreneur_visible" ? Eye : visibility === "anonymized" ? EyeOff : Archive

  return (
    <Badge className={className[visibility]}>
      <Icon />
      {getOpportunityVisibilityLabel(visibility)}
    </Badge>
  )
}

export function OpportunityJourneyBadge({ journey }: { journey: OpportunityJourney }) {
  const config: Record<OpportunityJourney, { className: string; icon: React.ElementType }> = {
    draft: { className: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100", icon: Pencil },
    live_in_inventory: { className: "border-transparent bg-sky-100 text-sky-800 hover:bg-sky-100", icon: Inbox },
    matching: { className: "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100", icon: Handshake },
    proposed: { className: "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100", icon: Send },
    interest_received: { className: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100", icon: MessageCircle },
    active_pursuit: { className: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100", icon: Handshake },
    info_memo_received: { className: "border-transparent bg-cyan-100 text-cyan-800 hover:bg-cyan-100", icon: FileText },
    intermediary_meeting: { className: "border-transparent bg-violet-100 text-violet-800 hover:bg-violet-100", icon: Handshake },
    seller_meeting: { className: "border-transparent bg-violet-100 text-violet-800 hover:bg-violet-100", icon: Handshake },
    loi: { className: "border-transparent bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-100", icon: CheckCircle2 },
    closed: { className: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100", icon: CheckCircle2 },
    dropped: { className: "border-transparent bg-red-100 text-red-800 hover:bg-red-100", icon: XCircle },
    paused: { className: "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100", icon: CirclePause },
    archived: { className: "border-transparent bg-zinc-100 text-zinc-700 hover:bg-zinc-100", icon: Archive },
  }

  const { className, icon: Icon } = config[journey]

  return (
    <Badge className={className}>
      <Icon />
      {getOpportunityJourneyLabel(journey)}
    </Badge>
  )
}
