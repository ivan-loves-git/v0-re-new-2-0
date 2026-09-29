import Link from "next/link"
import { requireStaffAccess } from "@/lib/access-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function OpportunityFreshnessRulePage() {
  await requireStaffAccess()
  const generationPaused = process.env.OPPORTUNITY_FRESHNESS_GENERATION_ENABLED === "false"
  const dispatchPaused = process.env.OPPORTUNITY_FRESHNESS_DISPATCH_ENABLED === "false"
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="wave-micro-label">Staff email automation</p><h1 className="text-2xl font-semibold">Opportunity freshness</h1></div>
      <Button asChild variant="outline" size="sm"><Link href="/emails">Back to email reviews</Link></Button>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">45-day source check <Badge variant="outline">Rule v1</Badge></CardTitle>
        <CardDescription>This is an internal rule description. Its link and evidence never appear in customer email.</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>A daily rule prepares unsent drafts for REAL active opportunities without an active REAL pursuit. It groups exact eligible opportunities by the same canonical intermediary contact, after current source, affiliation, recipient and suppression checks.</p>
        <p>An explicit recorded “still open” source reply resets only that opportunity’s 45-day clock. Older inventory without a recorded confirmation may enter with an honest age basis, even where legacy date precision is unknown. Sending, silence and unrelated changes never reset it.</p>
        <p>Staff review the exact group, edit or discard it, and explicitly send only when the template is enabled and every member is still eligible. One provider receipt covers the whole group. A sent email starts staff-owned follow-up, not an automatic chase or deadline.</p>
        <div className="flex flex-wrap gap-2"><Badge variant={generationPaused ? "secondary" : "outline"}>Draft generation {generationPaused ? "paused" : "enabled"}</Badge><Badge variant={dispatchPaused ? "secondary" : "outline"}>Grouped dispatch {dispatchPaused ? "paused" : "enabled"}</Badge></div>
      </CardContent>
    </Card>
  </div>
}
