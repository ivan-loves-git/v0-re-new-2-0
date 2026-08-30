import Link from "next/link"
import { requireStaffAccess } from "@/lib/access-control"
import { listHistoricalPdrWorkCards } from "@/lib/pdr/intake-server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function HistoricalPdrWorkCardsPage() {
  await requireStaffAccess()
  const cards = await listHistoricalPdrWorkCards()
  return <div className="space-y-6"><div><p className="wave-micro-label">Historical PDR evidence</p><h1 className="text-2xl font-semibold">Legacy Work Cards</h1><p className="text-sm text-muted-foreground">Presentation only. These records do not indicate current scope, delivery status, or authority; use GitHub for that.</p></div><Card><CardHeader><CardTitle>Frozen legacy records</CardTitle><CardDescription>No edits or delivery controls are available.</CardDescription></CardHeader><CardContent><ul className="divide-y">{cards.map((card) => <li key={card.id} className="py-3"><Link className="font-medium underline-offset-4 hover:underline" href={`/strategic-pdr/work-cards/${card.id}`}>W-{card.referenceNumber} · {card.title}</Link><p className="text-sm text-muted-foreground">Legacy owner: {card.owner} · former state: {card.status}</p></li>)}</ul></CardContent></Card></div>
}
