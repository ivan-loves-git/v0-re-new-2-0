import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Waves } from "lucide-react"
import { getCurrentUser } from "@/lib/auth-server"
import { getWavyTemplates, createWavyTemplate, deleteWavyTemplate } from "@/lib/actions/wavy"
import { WavyTool } from "@/components/wavy/wavy-tool"
import { Skeleton } from "@/components/ui/skeleton"
import { createAdminClient } from "@/lib/supabase/admin"

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
  // Fetch repreneurs directly instead of via server action
  const supabase = createAdminClient()
  const { data: repreneursData } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, phone, t1_score_v2, when_score_v2, will_score_v2, journey_stage")
    .is("rejected_at", null)
    .order("first_name")

  const repreneurs = (repreneursData || []).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    t1Score: r.t1_score_v2,
    whenScore: r.when_score_v2,
    willScore: r.will_score_v2,
    journeyStage: r.journey_stage,
  }))

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
      repreneurs={repreneurs}
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
