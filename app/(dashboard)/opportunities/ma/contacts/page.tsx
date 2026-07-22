import { ContactRound } from "lucide-react";
import { MaContactDirectory } from "@/components/opportunities/ma-contact-directory";
import { SectionPageHeader } from "@/components/ui/section-page-header";
import {
  listMaSourceContactsDirectory,
  listMaSourceDirectory,
} from "@/lib/actions/ma-sources";

export default async function MaContactsPage() {
  const [contacts, sources] = await Promise.all([
    listMaSourceContactsDirectory(),
    listMaSourceDirectory(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="M&A contacts"
        subtitle="Update intermediary people, move them between firms, and retain immutable history."
        icon={ContactRound}
        tone="opportunity"
      />

      <MaContactDirectory contacts={contacts} sources={sources} />
    </div>
  );
}
