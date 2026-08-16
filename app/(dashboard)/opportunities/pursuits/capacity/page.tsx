import { Gauge } from "lucide-react"
import { ExternalPursuitCapacityWorkspace } from "@/components/pursuits/external-pursuit-capacity-workspace"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { getExternalPursuitCapacitySnapshot } from "@/lib/actions/external-pursuit-capacity"

export default async function ExternalPursuitCapacityPage() {
  const snapshot = await getExternalPursuitCapacitySnapshot()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="External capacity"
        subtitle="Staff-only availability and freshness for independent acquisition dossiers."
        icon={Gauge}
        tone="opportunity"
      />
      <ExternalPursuitCapacityWorkspace snapshot={snapshot} />
    </div>
  )
}
