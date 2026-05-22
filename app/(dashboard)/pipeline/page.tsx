import { StaticPipelineBoard } from "@/components/pipeline/static-pipeline-board"
import { getRepreneurListSnapshot } from "@/lib/data/dashboard-snapshots"

export default async function PipelinePage() {
  const repreneurs = await getRepreneurListSnapshot()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Pipeline</h1>
        <p className="text-gray-600 mt-1">Visual overview of repreneurs by status</p>
      </div>

      <StaticPipelineBoard repreneurs={repreneurs} />
    </div>
  )
}
