import { MaRelationshipWorkspace } from "@/components/opportunities/ma-relationship-workspace"
import { getMaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

interface MaPageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function MaPage({ searchParams }: MaPageProps) {
  const { view } = await searchParams
  const initialView = view === "firms" || view === "contacts" ? view : "timeline"
  const workspace = await getMaRelationshipWorkspace()
  return (
    <MaRelationshipWorkspace
      key={initialView}
      workspace={workspace}
      initialView={initialView}
    />
  )
}
