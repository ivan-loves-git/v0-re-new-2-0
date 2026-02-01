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
  // Fetch repreneurs via internal API to work around RSC issues
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  let repreneurs: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    t1Score: number | null
    whenScore: number | null
    willScore: number | null
    journeyStage: string | null
  }> = []

  try {
    const response = await fetch(`${baseUrl}/api/wavy/test`, {
      cache: "no-store",
    })
    if (response.ok) {
      const data = await response.json()
      repreneurs = (data.repreneurs || []).map((r: { id: string; name: string; email: string }) => ({
        id: r.id,
        firstName: r.name.split(" ")[0] || "",
        lastName: r.name.split(" ").slice(1).join(" ") || "",
        email: r.email,
        phone: null,
        t1Score: null,
        whenScore: null,
        willScore: null,
        journeyStage: null,
      }))
    }
  } catch (error) {
    console.error("[Wavy Page] Failed to fetch repreneurs:", error)
  }

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
