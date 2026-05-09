import { getAssessmentByToken } from '@/lib/actions/leadership-assessment'
import { AssessmentPageClient } from './assessment-page-client'

interface AssessmentPageProps {
  params: Promise<{ token: string }>
}

export default async function AssessmentPage({ params }: AssessmentPageProps) {
  const { token } = await params
  const { assessment, repreneur } = await getAssessmentByToken(token)

  if (!assessment) {
    return <AssessmentPageClient status="not_found" token={token} />
  }

  if (assessment.completed_at) {
    return <AssessmentPageClient status="completed" token={token} />
  }

  return (
    <AssessmentPageClient
      status="valid"
      token={token}
      repreneurName={repreneur?.first_name || undefined}
    />
  )
}
