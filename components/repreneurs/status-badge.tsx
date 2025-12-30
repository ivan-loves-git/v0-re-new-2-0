import { Badge } from "@/components/ui/badge"
import type { LifecycleStatus } from "@/lib/types/repreneur"

interface StatusBadgeProps {
  status: LifecycleStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants: Record<LifecycleStatus, { label: string; className: string }> = {
    lead: { label: "Lead", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
    qualified: { label: "Qualified", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
    client: { label: "Client", className: "bg-green-100 text-green-800 hover:bg-green-100" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  }

  const variant = variants[status]

  return <Badge className={variant.className}>{variant.label}</Badge>
}
