"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { calculateDualScore } from "@/lib/utils/scoring-v2"
import { sendEmail } from "@/lib/email"
import { getTemplateSubject, getTemplateBody } from "@/lib/email/template-content"
import { WelcomeEmail } from "@/lib/email/templates/welcome"
import type { WhoAnswers, WhenAnswers } from "@/lib/types/scoring-v2"
import type { IntakeV2FormData, IntakeV2SubmissionResult } from "@/lib/types/intake-v2"
import { canonicalSectorSelections } from "@/lib/utils/opportunity-sector"
import {
  frenchTargetThesisNumericValidationMessage,
  targetThesisNumericValidationMessage,
} from "@/lib/repreneur-target-thesis"
import {
  claimPrivateIntakeUploads,
  parsePrivateIntakeUploadHandle,
} from "@/lib/private-upload-server"

export function validateIntakeTargetThesis(formData: Pick<
  IntakeV2FormData,
  | "target_revenue_min_meur"
  | "target_revenue_max_meur"
  | "target_ebitda_min_keur"
  | "target_ebitda_max_keur"
  | "target_ebitda_margin_min_pct"
  | "target_staff_size_min"
  | "target_staff_size_max"
>) {
  return frenchTargetThesisNumericValidationMessage(targetThesisNumericValidationMessage(formData))
}

/**
 * Submit complete intake form v2
 *
 * This is a single-submission action (not step-by-step like v1).
 * It calculates WHO/WHEN scores and inserts the complete record.
 */
export async function submitIntakeV2(
  formData: IntakeV2FormData
): Promise<IntakeV2SubmissionResult> {
  try {
    const cvUpload=parsePrivateIntakeUploadHandle(formData.cv_url)
    const ldcUpload=parsePrivateIntakeUploadHandle(formData.q18_investment_thesis_url)
    if (formData.cv_url?.startsWith("w165-intake:") && !cvUpload) {
      return { success: false, error: "Le CV téléversé n’est plus valide. Veuillez le sélectionner à nouveau." }
    }
    if (formData.q18_investment_thesis_url?.startsWith("w165-intake:") && !ldcUpload) {
      return { success: false, error: "La lettre de cadrage téléversée n’est plus valide. Veuillez la sélectionner à nouveau." }
    }
    const targetSectors = canonicalSectorSelections(formData.q13_target_sectors_v2, false)
    if (targetSectors.length === 0) {
      return { success: false, error: "Sélectionnez au moins un secteur cible." }
    }
    const targetThesisError = validateIntakeTargetThesis(formData)
    if (targetThesisError) return { success: false, error: targetThesisError }

    const supabase = createAdminClient()

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from("repreneurs")
      .select("id")
      .eq("email", formData.email.toLowerCase().trim())
      .maybeSingle()

    if (checkError) {
      console.error("Error checking existing email:", checkError)
      return { success: false, error: "Erreur lors de la vérification. Veuillez réessayer." }
    }

    if (existing) {
      return { success: false, error: "Cette adresse email est déjà enregistrée." }
    }

    // Calculate WHO score
    const whoAnswers: WhoAnswers = {
      q05: formData.q05_status as WhoAnswers['q05'],
      q06: formData.q06_experience as WhoAnswers['q06'],
      q07: formData.q07_leadership as WhoAnswers['q07'],
      q08: formData.q08_crisis as WhoAnswers['q08'],
      q09: formData.q09_investment as WhoAnswers['q09'],
      q10: formData.q10_impact as WhoAnswers['q10']
    }

    // Calculate WHEN score
    const whenAnswers: WhenAnswers = {
      q11: formData.q11_project_status as WhenAnswers['q11'],
      q12: formData.q12_geo_zones,
      q13: targetSectors,
      q14: formData.q14_deal_size as WhenAnswers['q14'],
      q15: formData.q15_structure as WhenAnswers['q15'],
      q16: formData.q16_equity as WhenAnswers['q16'],
      // v3: priority choice + fiche de cadrage presence drive three -10 penalties.
      q11_priority: (formData.q11_priority_choice || null) as WhenAnswers['q11_priority'],
      hasFicheDeCadrage: Boolean(formData.q18_investment_thesis_url),
    }

    // Calculate dual score
    const dualScore = calculateDualScore(whoAnswers, whenAnswers)

    // Prepare record for insertion
    const now = new Date().toISOString()
    const record = {
      // Contact info
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.toLowerCase().trim(),
      phone: formData.phone.trim(),
      // W-165 intake handles are claimed after the row exists. Legacy private
      // paths remain accepted for already-open drafts during the cutover.
      cv_url: cvUpload ? null : formData.cv_url,
      ldc_url: ldcUpload ? null : formData.q18_investment_thesis_url || null,
      linkedin_url: formData.linkedin_url?.trim() || null,

      // WHO answers (Q05-Q10)
      q05_status: formData.q05_status,
      q06_experience: formData.q06_experience,
      q07_leadership: formData.q07_leadership,
      q08_crisis: formData.q08_crisis,
      q09_investment: formData.q09_investment,
      q10_impact: formData.q10_impact,

      // Q11 v3 priority choice
      q11_priority_choice: formData.q11_priority_choice || null,
      // Needs (Q18 in Notion spec / q17 in code)
      q17_current_needs: formData.q17_current_needs,
      // WHEN answers (Q11-Q16)
      q11_project_status: formData.q11_project_status,
      q12_geo_zones: formData.q12_geo_zones,
      q13_target_sectors_v2: targetSectors,
      q14_deal_size: formData.q14_deal_size,
      q15_structure: formData.q15_structure,
      q16_equity: formData.q16_equity,
      target_revenue_min_meur: formData.target_revenue_min_meur,
      target_revenue_max_meur: formData.target_revenue_max_meur,
      target_ebitda_min_keur: formData.target_ebitda_min_keur,
      target_ebitda_max_keur: formData.target_ebitda_max_keur,
      target_ebitda_margin_min_pct: formData.target_ebitda_margin_min_pct,
      target_staff_size_min: formData.target_staff_size_min,
      target_staff_size_max: formData.target_staff_size_max,

      // Dual scores
      who_score: dualScore.who.score,
      when_score: dualScore.when.score,
      who_score_breakdown: dualScore.who.breakdown,
      when_score_breakdown: dualScore.when.breakdown,
      scoring_flags: dualScore.flags.flags,
      recommendation: dualScore.recommendation,

      // Also set legacy sector_preferences for backward compatibility
      sector_preferences: targetSectors,

      // Status & metadata
      lifecycle_status: "lead" as const,
      source: "intake_v2",
      consent_source: "intake_form_v2",
      marketing_consent: formData.marketing_consent,
      consent_timestamp: formData.marketing_consent ? now : null,
      questionnaire_completed_at: now,
    }

    // Insert the record
    const { data: repreneur, error: insertError } = await supabase
      .from("repreneurs")
      .insert(record)
      .select("id")
      .single()

    if (insertError) {
      console.error("Error inserting repreneur:", insertError)
      if (insertError.code === "23505") {
        return { success: false, error: "Cette adresse email est déjà enregistrée." }
      }
      return { success: false, error: "Erreur lors de l'enregistrement. Veuillez réessayer." }
    }

    if (cvUpload || ldcUpload) {
      try {
        await claimPrivateIntakeUploads(repreneur.id,cvUpload,ldcUpload)
      } catch (claimError) {
        const {error:rollbackError}=await supabase.from("repreneurs").delete().eq("id",repreneur.id)
        if (rollbackError) console.error("W-165 intake claim compensation failed",rollbackError)
        console.error("W-165 intake document claim failed",claimError)
        return { success: false, error: "Le document téléversé n’est plus valide. Veuillez le sélectionner à nouveau." }
      }
    }

    // Revalidate relevant paths
    revalidatePath("/repreneurs")
    revalidatePath("/pipeline")
    revalidatePath("/dashboard_re")
    revalidateRepreneurDashboardTags()

    // Send the welcome email. Transactional (no consent gate). Failure here
    // must not block the submission flow — log and continue.
    const welcomeSubject = await getTemplateSubject("welcome", "Bienvenue chez Re-New !")
    const welcomeBody = await getTemplateBody("welcome")
    sendEmail({
      to: record.email,
      subject: welcomeSubject,
      repreneurId: repreneur.id,
      templateKey: "welcome",
      react: WelcomeEmail({
        repreneur: {
          id: repreneur.id,
          firstName: record.first_name,
          lastName: record.last_name,
          email: record.email,
        },
        bodyOverride: welcomeBody,
      }),
    }).catch((err) => {
      console.error("Welcome email failed for", record.email, err)
    })

    // TODO: Send high score alert if recommendation is deal_flow or priority_interview

    return {
      success: true,
      repreneurId: repreneur.id,
      whoScore: dualScore.who.score,
      whenScore: dualScore.when.score,
      recommendation: dualScore.recommendation
    }
  } catch (err) {
    console.error("Unexpected error in submitIntakeV2:", err)
    return { success: false, error: "Une erreur inattendue s'est produite. Veuillez réessayer." }
  }
}
