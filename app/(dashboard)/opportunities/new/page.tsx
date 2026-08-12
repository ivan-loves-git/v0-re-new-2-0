import Link from "next/link"
import { ArrowLeft, BriefcaseBusiness } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import {
  createOpportunityIntake,
  listOpportunityGeographyOptions,
  listMaOfficeIntakeOptions,
} from "@/lib/actions/opportunity-intake"
import { isFranceGeographyMandatesEnabled } from "@/lib/opportunity-geography-release"

export default async function NewOpportunityPage() {
  const geographyMandatesEnabled = isFranceGeographyMandatesEnabled()
  const [officeOptions, geographyOptions] = await Promise.all([
    listMaOfficeIntakeOptions(),
    geographyMandatesEnabled ? listOpportunityGeographyOptions() : [],
  ])

  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="New opportunity"
        subtitle="Create a staff-owned draft, then complete the operating-office context before activation."
        icon={BriefcaseBusiness}
        tone="opportunity"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/opportunities/find">
              <ArrowLeft className="size-4" />
              Back to opportunities
            </Link>
          </Button>
        }
      />

      <OpportunityForm
        action={createOpportunityIntake}
        submitLabel="Create opportunity"
        officeOptions={officeOptions}
        geographyOptions={geographyOptions}
        geographyMandatesEnabled={geographyMandatesEnabled}
      />
    </div>
  )
}
