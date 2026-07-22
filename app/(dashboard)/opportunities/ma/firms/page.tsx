import { Building2 } from "lucide-react";
import { MaSourceDirectory } from "@/components/opportunities/ma-source-directory";
import { SectionPageHeader } from "@/components/ui/section-page-header";
import { listMaSourceDirectory } from "@/lib/actions/ma-sources";

export default async function MaFirmsPage() {
  const sources = await listMaSourceDirectory();

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="M&A firms"
        subtitle="Manage intermediary firms, network groups, source coverage, and their contacts."
        icon={Building2}
        tone="opportunity"
      />

      <MaSourceDirectory sources={sources} />
    </div>
  );
}
