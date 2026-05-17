import { redirect } from "next/navigation"

export default async function MyOpportunityDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  redirect(`/portal/deals/${matchId}`)
}
