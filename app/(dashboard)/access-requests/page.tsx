import { Inbox } from "lucide-react"

import { AccessRequestReviewTable } from "@/components/repreneurs/access-request-review-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { getWaitlistReviewRequests } from "@/lib/actions/waitlist-review"

interface AccessRequestsPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function AccessRequestsPage({ searchParams }: AccessRequestsPageProps) {
  const { q = "" } = await searchParams
  const requests = await getWaitlistReviewRequests(q)

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Access requests"
        subtitle="Review public requests and link confirmed repreneurs to the people pipeline."
        icon={Inbox}
        tone="repreneur"
      />

      <form className="flex max-w-xl items-center gap-2" action="/access-requests">
        <Input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search access requests" />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <AccessRequestReviewTable requests={requests} />
    </div>
  )
}
