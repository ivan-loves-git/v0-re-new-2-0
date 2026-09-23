"use client"

import { useRef } from "react"
import { RepreneurTargetThesisEditor } from "@/components/portal/repreneur-target-thesis-editor"
import { updateRepreneurTargetThesis, type TargetThesisInput } from "@/lib/actions/repreneur-profile"
import type { PortalRepreneurProfile } from "@/lib/data/portal-profile"

export function StaffTargetThesisAction({ repreneur }: { repreneur: PortalRepreneurProfile }) {
  const retry = useRef<{ fingerprint: string; key: string } | null>(null)
  const name = [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") || "this repreneur"
  async function save(input: TargetThesisInput) {
    const fingerprint = JSON.stringify(input)
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() }
    await updateRepreneurTargetThesis(repreneur.id, input, repreneur.updated_at, retry.current.key)
    retry.current = null
  }
  return <RepreneurTargetThesisEditor
    repreneur={repreneur}
    onSave={save}
    staffAssistanceName={name}
    triggerLabel="Edit thesis as staff"
    title={`Edit ${name}'s target thesis`}
    description="Your staff identity and the changed fields will be recorded. The repreneur's personal declarations remain theirs."
    saveLabel="Save attributed staff edit"
    successMessage={`Target thesis updated for ${name}.`}
  />
}
