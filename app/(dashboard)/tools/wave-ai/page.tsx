import Link from "next/link"
import { BarChart3, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { WaveAiTool } from "@/components/wave-ai/wave-ai-tool"
import { requireStaffAccess } from "@/lib/access-control"
import { getWaveAiCustomTemplates } from "@/lib/actions/wave-ai"

export const dynamic = "force-dynamic"

export default async function WaveAiPage({
  searchParams,
}: {
  searchParams: Promise<{ repreneur?: string }>
}) {
  await requireStaffAccess()
  const params = await searchParams
  const preselectedRepreneurId = /^[0-9a-f-]{36}$/i.test(params.repreneur ?? "")
    ? params.repreneur
    : undefined
  const templates = await getWaveAiCustomTemplates()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader
        title="WAVE AI"
        subtitle="Staff-only email drafting with explicit human review"
        icon={Sparkles}
        tone="neutral"
        actions={
          <Button variant="outline" asChild>
            <Link href="/tools/wave-ai/usage"><BarChart3 /> Usage</Link>
          </Button>
        }
      />
      <WaveAiTool customTemplates={templates} preselectedRepreneurId={preselectedRepreneurId} />
    </div>
  )
}

