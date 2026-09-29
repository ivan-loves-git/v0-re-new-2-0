import Link from "next/link"
import { connection } from "next/server"
import { Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { ProductIntelligenceCockpit } from "@/components/wave-ai/product-intelligence-cockpit"
import { requireStaffAccess } from "@/lib/access-control"
import { getWaveAiDashboardSnapshot } from "@/lib/ai/ledger"

export default async function ProductIntelligencePage({ searchParams }: {
  searchParams: Promise<{ window?: string }>
}) {
  await connection()
  await requireStaffAccess()
  const params = await searchParams
  const days: 7 | 30 = params.window === "30" ? 30 : 7
  const snapshot = await getWaveAiDashboardSnapshot(days)

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <SectionPageHeader title="Product intelligence"
      subtitle="What the recorded product and AI evidence can currently support"
      icon={Activity} tone="neutral" actions={<div className="flex flex-wrap gap-2">
        <Button variant={days === 7 ? "secondary" : "ghost"} size="sm" asChild>
          <Link href="/tools/product-intelligence?window=7" aria-current={days === 7 ? "page" : undefined}>7 days</Link>
        </Button>
        <Button variant={days === 30 ? "secondary" : "ghost"} size="sm" asChild>
          <Link href="/tools/product-intelligence?window=30" aria-current={days === 30 ? "page" : undefined}>30 days</Link>
        </Button>
      </div>} />
    <ProductIntelligenceCockpit snapshot={snapshot} />
  </div>
}
