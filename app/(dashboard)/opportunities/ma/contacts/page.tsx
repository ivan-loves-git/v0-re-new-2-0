import { MaRelationshipWorkspace } from "@/components/opportunities/ma-relationship-workspace"
import { getMaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

interface MaContactsPageProps {
  searchParams: Promise<{ contactId?: string }>
}

export default async function MaContactsPage({
  searchParams,
}: MaContactsPageProps) {
  const { contactId } = await searchParams
  const workspace = await getMaRelationshipWorkspace()
  const initialContactId = workspace.contacts.some(
    (contact) => contact.id === contactId,
  )
    ? contactId
    : null

  return (
    <MaRelationshipWorkspace
      workspace={workspace}
      initialView="contacts"
      initialContactId={initialContactId}
    />
  )
}
