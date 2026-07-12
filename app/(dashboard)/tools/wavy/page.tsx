import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Waves } from "lucide-react"
import { getCurrentUser } from "@/lib/auth-server"
import { getWavyTemplates, createWavyTemplate, deleteWavyTemplate } from "@/lib/actions/wavy"
import { WavyTool } from "@/components/wavy/wavy-tool"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionPageHeader } from "@/components/ui/section-page-header"

interface PageProps {
  searchParams: Promise<{ repreneur?: string }>
}

export default async function WavyPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/login")
  }

  const params = await searchParams
  const preselectedRepreneurId = params.repreneur

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionPageHeader title="Wavy" subtitle="AI-assisted, context-aware communication for Re-New workflows" icon={Waves} tone="neutral" />

      <Suspense fallback={<WavyToolSkeleton />}>
        <WavyToolLoader preselectedRepreneurId={preselectedRepreneurId} />
      </Suspense>
    </div>
  )
}

async function WavyToolLoader({
  preselectedRepreneurId,
}: {
  preselectedRepreneurId?: string
}) {
  // Note: repreneurs are fetched client-side in WavyTool component
  // to work around Vercel RSC issues with Supabase
  const templates = await getWavyTemplates()

  // Server actions for template management
  async function handleAddTemplate(template: {
    name: string
    description: string
    channel: "email" | "whatsapp"
  }) {
    "use server"
    await createWavyTemplate(template)
  }

  async function handleDeleteTemplate(templateId: string) {
    "use server"
    await deleteWavyTemplate(templateId)
  }

  return (
    <WavyTool
      customTemplates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        channel: t.channel as "email" | "whatsapp",
      }))}
      onAddTemplate={handleAddTemplate}
      onDeleteTemplate={handleDeleteTemplate}
      preselectedRepreneurId={preselectedRepreneurId}
    />
  )
}

function WavyToolSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-[500px] rounded-lg" />
      <Skeleton className="h-[500px] rounded-lg" />
    </div>
  )
}
