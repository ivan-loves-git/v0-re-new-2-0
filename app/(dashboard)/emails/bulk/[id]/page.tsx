import { notFound } from "next/navigation"
import { getStaffEmailBulk } from "@/lib/actions/staff-email-bulk"
import { BulkEmailConfirmation } from "./bulk-confirmation"

export default async function StaffBulkEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const record = await getStaffEmailBulk(id)
    return <BulkEmailConfirmation initial={record} />
  } catch {
    notFound()
  }
}
