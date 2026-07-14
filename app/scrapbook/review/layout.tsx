import { Suspense } from "react"
import { connection } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"

async function StaffBoundary({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection()
  await requireStaffAccess()
  return children
}

export default function ScrapbookReviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <StaffBoundary>{children}</StaffBoundary>
    </Suspense>
  )
}
