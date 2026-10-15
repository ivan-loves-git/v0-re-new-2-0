"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateMaRelationshipWorkspaceNotes } from "@/lib/actions/ma-relationship-workspaces"

export function MaRelationshipWorkspaceNotes({
  target,
  id,
  initialNotes,
  initialCity,
}: {
  target: "office" | "firm"
  id: string
  initialNotes: string | null
  initialCity?: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [city, setCity] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
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
      {target === "office" && !initialCity?.trim() ? <div className="space-y-2">
        <Label htmlFor={`${id}-notes-city`}>City (required to save this office)</Label>
        <Input id={`${id}-notes-city`} value={city} onChange={(event) => setCity(event.target.value)} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? `${id}-notes-city-error` : undefined} />
        {errors.city ? <p id={`${id}-notes-city-error`} role="alert" className="text-sm text-destructive">{errors.city}</p> : null}
      </div> : null}
      {errors.form ? <p role="alert" className="text-sm text-destructive">{errors.form}</p> : null}
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
              setErrors({})
              const result = await updateMaRelationshipWorkspaceNotes(
                target,
                id,
                notes,
                city,
              )
              if (!result.success) {
                setErrors(result.fieldErrors ?? { form: result.message })
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
            setCity("")
            setErrors({})
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
