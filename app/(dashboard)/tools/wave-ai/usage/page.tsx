import Link from "next/link"
import { connection } from "next/server"
import { ArrowLeft, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { WaveAiUsageDashboard } from "@/components/wave-ai/usage-dashboard"
import { requireStaffAccess } from "@/lib/access-control"
import { getWaveAiDashboardSnapshot } from "@/lib/ai/ledger"

export default async function WaveAiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>
}) {
  await connection()
  await requireStaffAccess()
  const params = await searchParams
  const days: 7 | 30 = params.window === "30" ? 30 : 7
  const snapshot = await getWaveAiDashboardSnapshot(days)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader
        title="WAVE AI usage"
        subtitle="Recorded production usage, follow-through and estimated ledger cost"
        icon={BarChart3}
        tone="neutral"
        actions={
          <div className="flex items-center gap-2">
            <Button variant={days === 7 ? "secondary" : "ghost"} size="sm" asChild><Link href="/tools/wave-ai/usage?window=7">7 days</Link></Button>
            <Button variant={days === 30 ? "secondary" : "ghost"} size="sm" asChild><Link href="/tools/wave-ai/usage?window=30">30 days</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/tools/wave-ai"><ArrowLeft /> Draft</Link></Button>
          </div>
        }
      />
      <WaveAiUsageDashboard snapshot={snapshot} />
    </div>
  )
}
