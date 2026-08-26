import { StaticPipelineBoard } from "@/components/pipeline/static-pipeline-board"
import { getRepreneurListSnapshot } from "@/lib/data/dashboard-snapshots"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { GitBranch } from "lucide-react"

export default async function PipelinePage() {
  const repreneurs = (await getRepreneurListSnapshot()).filter(
    (repreneur) => !repreneur.is_demo,
  )

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Pipeline"
        subtitle="Review repreneurs across each lifecycle stage and open the next record that needs attention."
        icon={GitBranch}
        tone="repreneur"
      />

      <StaticPipelineBoard repreneurs={repreneurs} />
    </div>
  )
}
