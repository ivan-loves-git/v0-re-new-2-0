import { Handshake } from "lucide-react"
import { MaSourceDirectory } from "@/components/opportunities/ma-source-directory"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { listMaSourceDirectory } from "@/lib/actions/ma-sources"

export const revalidate = 30

export default async function MaSourcesPage() {
  const sources = await listMaSourceDirectory()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="M&A"
        subtitle="Manage intermediary contacts, source coverage, and follow-up templates for opportunity flow."
        icon={Handshake}
        tone="opportunity"
      />

      <MaSourceDirectory sources={sources} />
    </div>
  )
}
