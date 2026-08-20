import { formatDisplayDateTime } from "@/lib/utils/display-date-time"

export function formatPursuitDateTime(value: string) {
  return formatDisplayDateTime(value, "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
