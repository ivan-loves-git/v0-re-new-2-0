import { getStaffEmailReview } from "@/lib/actions/staff-email-review"
import { ReviewDetail } from "./review-detail"

export default async function StaffEmailReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getStaffEmailReview(id)
  return <ReviewDetail initial={record} />
}
