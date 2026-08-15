"use client"

import { updateRepreneurTargetThesis } from "@/lib/actions/repreneur-profile"
import {
  RepreneurTargetThesisEditor,
  type TargetThesisProfile,
} from "@/components/portal/repreneur-target-thesis-editor"

/** Staff editor for the exact shared fields the repreneur can maintain. */
export function StaffRepreneurTargetThesisEditor({ repreneur }: { repreneur: TargetThesisProfile }) {
  return (
    <RepreneurTargetThesisEditor
      repreneur={repreneur}
      onSave={(input) => updateRepreneurTargetThesis(repreneur.id, input)}
      successMessage="Acquisition project updated. Matching has been refreshed."
    />
  )
}
