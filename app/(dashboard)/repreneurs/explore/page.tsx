import { RepreneursExplorePage } from "@/components/repreneurs/repreneurs-explore-page"
import { getRepreneurListSnapshot } from "@/lib/data/dashboard-snapshots"

export default async function RepreneurExplorePage() {
  const repreneurs = await getRepreneurListSnapshot()

  return <RepreneursExplorePage repreneurs={repreneurs} />
}
