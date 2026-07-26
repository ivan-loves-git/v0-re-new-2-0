import { OpportunityImportReview } from "@/components/opportunities/opportunity-import-review"
import { requireStaffAccess } from "@/lib/access-control"
import { getSyntheticMaCutoverRehearsal } from "@/lib/utils/ma-cutover"

export default async function OpportunityImportPage() {
  await requireStaffAccess()

  return <OpportunityImportReview rehearsal={getSyntheticMaCutoverRehearsal()} />
}
