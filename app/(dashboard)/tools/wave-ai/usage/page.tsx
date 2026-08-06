import Link from "next/link"
import { ArrowLeft, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { WaveAiUsageDashboard } from "@/components/wave-ai/usage-dashboard"
import { requireStaffAccess } from "@/lib/access-control"
import { getWaveAiDashboardMetrics } from "@/lib/ai/ledger"

export const dynamic = "force-dynamic"

export default async function WaveAiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>
}) {
  await requireStaffAccess()
  const params = await searchParams
  const days: 7 | 30 = params.window === "30" ? 30 : 7
  const metrics = await getWaveAiDashboardMetrics(days)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader
        title="WAVE AI usage"
        subtitle="Volume, useful outcomes, reliability and estimated OpenAI cost"
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
      <WaveAiUsageDashboard metrics={metrics} days={days} />
    </div>
  )
}

