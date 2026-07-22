import Link from "next/link"
import { ArrowLeft, BriefcaseBusiness } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import { createOpportunity } from "@/lib/actions/opportunities"
import { listMaSourceDirectory } from "@/lib/actions/ma-sources"

export default async function NewOpportunityPage() {
  const sourceDirectory = await listMaSourceDirectory()
  const sourceOptions = sourceDirectory.map(
    ({ id, firm_name, source_type, internal_notes, contacts }) => ({
      id,
      firm_name,
      source_type,
      internal_notes,
      contacts,
    }),
  )

  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="New opportunity"
        subtitle="Create the operational record and define what can be shared with repreneurs"
        icon={BriefcaseBusiness}
        tone="opportunity"
        actions={<Button asChild variant="outline" size="sm"><Link href="/opportunities/find"><ArrowLeft className="size-4" />Back to opportunities</Link></Button>}
      />

      <OpportunityForm
        action={createOpportunity}
        submitLabel="Create opportunity"
        sourceOptions={sourceOptions}
      />
    </div>
  )
}
