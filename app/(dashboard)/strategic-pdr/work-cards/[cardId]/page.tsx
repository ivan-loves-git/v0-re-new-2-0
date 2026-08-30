import { notFound } from "next/navigation"
import { requireStaffAccess } from "@/lib/access-control"
import { listHistoricalPdrWorkCards } from "@/lib/pdr/intake-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isUuid } from "@/lib/uuid"

export default async function HistoricalPdrWorkCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  await requireStaffAccess(); const { cardId } = await params; if (!isUuid(cardId)) notFound()
  const card = (await listHistoricalPdrWorkCards()).find((item) => item.id === cardId); if (!card) notFound()
  return <div className="space-y-6"><div><p className="wave-micro-label">Historical PDR evidence</p><h1 className="text-2xl font-semibold">W-{card.referenceNumber} · {card.title}</h1><p className="text-sm text-muted-foreground">Frozen presentation-only legacy record. GitHub is the current delivery authority.</p></div><Card><CardHeader><CardTitle>Legacy notes</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{card.notes || "No legacy notes recorded."}</CardContent></Card><Card><CardHeader><CardTitle>Former metadata</CardTitle></CardHeader><CardContent className="text-sm">Former state: {card.status} · Legacy owner: {card.owner}</CardContent></Card></div>
}
