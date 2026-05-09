import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Waves } from "lucide-react"
import { getCurrentUser } from "@/lib/auth-server"
import { getWavyTemplates, createWavyTemplate, deleteWavyTemplate } from "@/lib/actions/wavy"
import { WavyTool } from "@/components/wavy/wavy-tool"
import { Skeleton } from "@/components/ui/skeleton"

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
    <div className="container max-w-6xl py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Waves className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Wavy</h1>
            <p className="text-muted-foreground">
              AI-powered writing assistant for team communications
            </p>
          </div>
        </div>
      </div>

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
