'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { calculateDualScore } from '@/lib/utils/scoring-v2'
import type { IntakeV2FormData, IntakeV2SubmissionResult } from '@/lib/types/intake-v2'
import type { WhoAnswers, WhenAnswers } from '@/lib/types/scoring-v2'

/**
 * Submit intake form v2
 * Calculates dual scores and creates repreneur record
 */
export async function submitIntakeV2(
  formData: IntakeV2FormData
): Promise<IntakeV2SubmissionResult> {
  try {
    const supabase = createAdminClient()

    // 1. Build WHO answers from form data
    const whoAnswers: WhoAnswers = {
      q05: formData.q05_status as WhoAnswers['q05'],
      q06: formData.q06_experience as WhoAnswers['q06'],
      q07: formData.q07_leadership as WhoAnswers['q07'],
      q08: formData.q08_crisis as WhoAnswers['q08'],
      q09: formData.q09_investment as WhoAnswers['q09'],
      q10: formData.q10_impact as WhoAnswers['q10']
    }

    // 2. Build WHEN answers from form data
    const whenAnswers: WhenAnswers = {
      q11: formData.q11_project_status as WhenAnswers['q11'],
      q12: formData.q12_geo_zones,
      q13: formData.q13_target_sectors_v2,
      q14: formData.q14_deal_size as WhenAnswers['q14'],
      q15: formData.q15_structure as WhenAnswers['q15'],
      q16: formData.q16_equity as WhenAnswers['q16']
    }

    // 3. Calculate dual scores
    const scoreResult = calculateDualScore(whoAnswers, whenAnswers)

    // 4. Prepare repreneur data
    const repreneurData = {
      // Contact info
      email: formData.email.toLowerCase().trim(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      phone: formData.phone.trim(),
      cv_url: formData.cv_url,
      linkedin_url: formData.linkedin_url || null,

      // WHO answers (Q05-Q10)
      q05_status: formData.q05_status,
      q06_experience: formData.q06_experience,
      q07_leadership: formData.q07_leadership,
      q08_crisis: formData.q08_crisis,
      q09_investment: formData.q09_investment,
      q10_impact: formData.q10_impact,

      // WHEN answers (Q11-Q16)
      q11_project_status: formData.q11_project_status,
      q12_geo_zones: formData.q12_geo_zones,
      q13_target_sectors_v2: formData.q13_target_sectors_v2,
      q14_deal_size: formData.q14_deal_size,
      q15_structure: formData.q15_structure,
      q16_equity: formData.q16_equity,

      // Needs (Q17-Q18)
      q17_current_needs: formData.q17_current_needs,
      q18_investment_thesis_url: formData.q18_investment_thesis_url,

      // Dual scores
      who_score: scoreResult.who.score,
      when_score: scoreResult.when.score,
      who_score_breakdown: scoreResult.who.breakdown,
      when_score_breakdown: scoreResult.when.breakdown,
      scoring_flags: scoreResult.flags.flags,
      recommendation: scoreResult.recommendation,

      // Metadata
      lifecycle_status: 'lead' as const,
      source: 'intake_v2',
      marketing_consent: formData.marketing_consent,
      consent_timestamp: new Date().toISOString(),
      consent_source: 'intake_form_v2',

      // Legacy fields - map what we can
      target_location: formData.q12_geo_zones,
      sector_preferences: formData.q13_target_sectors_v2,
      investment_capacity: mapEquityToInvestmentCapacity(formData.q16_equity),

      // Created by system
      created_by: '00000000-0000-0000-0000-000000000000' // System user UUID
    }

    // 5. Check for existing email
    const { data: existing } = await supabase
      .from('repreneurs')
      .select('id')
      .eq('email', repreneurData.email)
      .single()

    if (existing) {
      return {
        success: false,
        error: 'Cette adresse email est déjà enregistrée. Contactez-nous si vous souhaitez mettre à jour votre profil.'
      }
    }

    // 6. Insert repreneur
    const { data: repreneur, error } = await supabase
      .from('repreneurs')
      .insert(repreneurData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating repreneur:', error)
      return {
        success: false,
        error: 'Une erreur est survenue lors de l\'enregistrement. Veuillez réessayer.'
      }
    }

    // 7. Send welcome email (async, don't block)
    sendWelcomeEmail(repreneurData.email, repreneurData.first_name).catch(err => {
      console.error('Failed to send welcome email:', err)
    })

    // 8. If high score, send internal alert
    if (scoreResult.recommendation === 'deal_flow' || scoreResult.recommendation === 'priority_interview') {
      sendHighScoreAlert(repreneur.id, scoreResult.who.score, scoreResult.when.score).catch(err => {
        console.error('Failed to send high score alert:', err)
      })
    }

    return {
      success: true,
      repreneurId: repreneur.id,
      whoScore: scoreResult.who.score,
      whenScore: scoreResult.when.score,
      recommendation: scoreResult.recommendation
    }

  } catch (error) {
    console.error('Intake submission error:', error)
    return {
      success: false,
      error: 'Une erreur inattendue est survenue. Veuillez réessayer.'
    }
  }
}

/**
 * Map equity contribution to legacy investment_capacity field
 */
function mapEquityToInvestmentCapacity(equity: string): string {
  const mapping: Record<string, string> = {
    'tbd': 'À définir',
    '151-250': '151-250 K€',
    '251-350': '251-350 K€',
    '351-450': '351-450 K€',
    '>450': '> 450 K€'
  }
  return mapping[equity] || equity
}

/**
 * Send welcome email to new repreneur
 */
async function sendWelcomeEmail(email: string, firstName: string) {
  // TODO: Implement with Resend
  console.log(`Would send welcome email to ${email} (${firstName})`)
}

/**
 * Send internal alert for high-scoring repreneurs
 */
async function sendHighScoreAlert(repreneurId: string, whoScore: number, whenScore: number) {
  // TODO: Implement with Resend to team
  console.log(`Would send high score alert for ${repreneurId}: WHO=${whoScore}, WHEN=${whenScore}`)
}
