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
      triggerLabel="Edit acquisition project"
      title="Update acquisition project"
      description="Correct the shared criteria this repreneur sees and WAVE uses for current matching. Staff-owned readiness decisions remain separate."
      saveLabel="Save acquisition project"
      errorMessage="Could not update this acquisition project."
    />
  )
}
