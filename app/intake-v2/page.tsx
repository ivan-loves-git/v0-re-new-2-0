import { getIntakeCriteria } from "@/lib/data/intake-criteria"
import { buildIntakeSteps } from "@/components/questionnaire"
import { IntakeFormV2 } from "@/components/intake-v2/intake-form-v2"

// Force dynamic rendering since we fetch from database
export const dynamic = "force-dynamic"

/**
 * Public Intake Form V2 - TanStack Form Version
 *
 * This is a server component that:
 * 1. Fetches evaluation criteria from the database
 * 2. Builds the form steps with dynamic options
 * 3. Passes them to the new TanStack Form based client component
 *
 * Features over v1:
 * - TanStack Form for state management
 * - Glass morphism progress bar
 * - Floating label inputs
 * - Auto-save to localStorage
 * - Progress persistence across page reloads
 * - Drag & drop file uploads
 * - Confetti celebration on completion
 */
export default async function IntakeV2Page() {
  // Fetch criteria from database (with fallback to static data)
  const criteria = await getIntakeCriteria()

  // Build steps with dynamic options
  const steps = buildIntakeSteps(criteria)

  return <IntakeFormV2 steps={steps} />
}
