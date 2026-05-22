import { RepreneursGroupsPage } from "@/components/repreneurs/repreneurs-groups-page"
import { getRepreneurListSnapshot } from "@/lib/data/dashboard-snapshots"

export default async function RepreneursPage() {
  const repreneurs = await getRepreneurListSnapshot()

  return <RepreneursGroupsPage repreneurs={repreneurs} />
}
