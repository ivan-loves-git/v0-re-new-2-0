import { connection } from "next/server"
import { RepreneurFeedbackForm } from "@/components/feedback/repreneur-feedback-form"

export default async function PortalFeedbackPage() {
  await connection()
  // The enclosing portal layout requires current repreneur PortalAccess.
  return <RepreneurFeedbackForm />
}
