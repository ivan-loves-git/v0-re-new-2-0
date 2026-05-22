import { Suspense } from 'react'
import { getAssessmentByToken } from '@/lib/actions/leadership-assessment'
import { connection } from 'next/server'
import { AssessmentPageClient } from './assessment-page-client'

interface AssessmentPageProps {
  params: Promise<{ token: string }>
}

export default function AssessmentPage({ params }: AssessmentPageProps) {
  return (
    <Suspense fallback={null}>
      <AssessmentContent params={params} />
    </Suspense>
  )
}

async function AssessmentContent({ params }: AssessmentPageProps) {
  await connection()

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
