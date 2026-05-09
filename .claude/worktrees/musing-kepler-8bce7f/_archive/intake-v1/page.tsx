import { getIntakeCriteria } from "@/lib/data/intake-criteria"
import { buildIntakeSteps } from "@/components/questionnaire"
import { IntakeForm } from "@/components/intake/intake-form"

// Force dynamic rendering since we fetch from database
export const dynamic = "force-dynamic"

/**
 * Public Intake Form Page
 *
 * This is a server component that:
 * 1. Fetches evaluation criteria from the database
 * 2. Builds the form steps with dynamic options
 * 3. Passes them to the client-side form component
 *
 * Changes made in the dashboard evaluation criteria editor
 * will be immediately reflected in this form.
 */
export default async function IntakePage() {
  // Fetch criteria from database (with fallback to static data)
  const criteria = await getIntakeCriteria()

  // Build steps with dynamic options
  const steps = buildIntakeSteps(criteria)

  return <IntakeForm steps={steps} />
}
