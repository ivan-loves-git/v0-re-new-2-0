import { redirect } from "next/navigation"

export default async function MyOpportunityDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  await params
  redirect("/dashboard")
}
