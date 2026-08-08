import { notFound } from "next/navigation";
import { MaFirmWorkspaceDetail } from "@/components/opportunities/ma-relationship-workspace-detail";
import { getMaFirmWorkspace } from "@/lib/actions/ma-relationship-workspaces";

export default async function MaFirmWorkspacePage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = await params;
  const workspace = await getMaFirmWorkspace(firmId);
  if (!workspace) notFound();
  return <MaFirmWorkspaceDetail workspace={workspace} />;
}
