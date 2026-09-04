import { LockKeyhole } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DEMO_CLASSIFICATION_MATCH_LOCK_MESSAGE,
  type DemoClassificationControlState,
} from "@/lib/demo-classification"

function formatAuditTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function DemoClassificationAuditLine({
  state,
}: {
  state: DemoClassificationControlState
}) {
  const timestamp = state.updatedAt ? formatAuditTimestamp(state.updatedAt) : null
  if (!timestamp) return null

  return (
    <p className="text-xs text-muted-foreground">
      Last changed <time dateTime={state.updatedAt ?? undefined}>{timestamp}</time>
      {state.updatedByLabel ? ` by ${state.updatedByLabel}` : ""}.
    </p>
  )
}

export function DemoClassificationLockNotice({
  state,
}: {
  state: DemoClassificationControlState
}) {
  const message = state.lockReason === "matched"
    ? DEMO_CLASSIFICATION_MATCH_LOCK_MESSAGE
    : "Classification is temporarily locked because WAVE could not verify the record's match history. Try again later."

  return (
    <div className="max-w-sm space-y-1.5 rounded-md border bg-muted/30 px-3 py-2">
      <Badge variant="outline">
        <LockKeyhole />
        Classification locked
      </Badge>
      <p className="text-xs text-muted-foreground">{message}</p>
      <DemoClassificationAuditLine state={state} />
    </div>
  )
}
