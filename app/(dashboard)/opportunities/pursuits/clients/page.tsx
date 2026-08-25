import { connection } from "next/server"
import { UsersRound } from "lucide-react"
import { ClientPursuitPortfolio } from "@/components/pursuits/client-pursuit-portfolio"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { listClientPursuitPortfolio } from "@/lib/actions/client-pursuit-portfolio"

export default async function ClientPursuitPortfolioPage() {
  await connection()
  const rows = await listClientPursuitPortfolio()

  return <div className="flex flex-col gap-6">
    <SectionPageHeader
      title="Client pursuit portfolio"
      subtitle="One staff view derived from accepted services and canonical Re-New pursuit records"
      icon={UsersRound}
      tone="opportunity"
    />
    <ClientPursuitPortfolio rows={rows} asOf={new Date().toISOString()} />
  </div>
}
