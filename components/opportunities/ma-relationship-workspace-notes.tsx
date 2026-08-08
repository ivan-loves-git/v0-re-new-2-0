"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { updateMaRelationshipWorkspaceNotes } from "@/lib/actions/ma-relationship-workspaces"

export function MaRelationshipWorkspaceNotes({
  target,
  id,
  initialNotes,
}: {
  target: "office" | "firm"
  id: string
  initialNotes: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [isPending, startTransition] = useTransition()
  if (!editing)
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-wrap text-sm">
          {initialNotes || "No internal notes recorded."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          <Pencil data-icon="inline-start" />
          Edit notes
        </Button>
      </div>
    )
  return (
    <div className="space-y-3">
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={5}
        aria-label="Internal notes"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateMaRelationshipWorkspaceNotes(
                target,
                id,
                notes,
              )
              if (!result.success) {
                toast.error(result.message)
                return
              }
              toast.success(result.message)
              setEditing(false)
              router.refresh()
            })
          }
        >
          {isPending ? "Saving..." : "Save notes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setNotes(initialNotes ?? "")
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
