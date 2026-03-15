'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/i18n/language-context'
import type { IntakeV2ReviewStepProps } from '@/lib/types/intake-v2'
import { Pencil, CheckCircle2, Loader2 } from 'lucide-react'

// Translation maps for displaying selected values
const WHO_OPTION_KEYS: Record<string, Record<string, string>> = {
  q05_status: {
    entrepreneur: 'q05_entrepreneur',
    freelance: 'q05_freelance',
    employee: 'q05_employee',
    transition: 'q05_transition',
    other: 'q05_other',
  },
  q06_experience: {
    more_than_20: 'q06_more_than_20',
    '10_to_20': 'q06_10_to_20',
    less_than_10: 'q06_less_than_10',
  },
  q07_leadership: {
    general_management: 'q07_general_management',
    mgmt_over_10: 'q07_mgmt_over_10',
    mgmt_under_10: 'q07_mgmt_under_10',
    none: 'q07_none',
  },
  q08_crisis: {
    multiple: 'q08_multiple',
    once: 'q08_once',
    none: 'q08_none',
  },
  q09_investment: {
    both: 'q09_both',
    personal: 'q09_personal',
    professional: 'q09_professional',
    none: 'q09_none',
  },
  q10_impact: {
    financial: 'q10_financial',
    trajectory: 'q10_trajectory',
    limited: 'q10_limited',
    none: 'q10_none',
  },
}

const Q11_OPTION_KEYS: Record<string, string> = {
  discovery: 'q11_discovery',
  exploratory: 'q11_exploratory',
  framed: 'q11_framed',
  searching: 'q11_searching',
  loi: 'q11_loi',
}

const WHEN_OPTION_KEYS: Record<string, Record<string, string>> = {
  q12: {
    'all-france': 'q12_all_france',
    'ile-de-france': 'q12_ile_de_france',
    'auvergne-rhone-alpes': 'q12_auvergne_rhone_alpes',
    'paca': 'q12_paca',
    'occitanie': 'q12_occitanie',
    'nouvelle-aquitaine': 'q12_nouvelle_aquitaine',
    'hauts-de-france': 'q12_hauts_de_france',
    'grand-est': 'q12_grand_est',
    'pays-de-la-loire': 'q12_pays_de_la_loire',
    'bretagne': 'q12_bretagne',
    'normandie': 'q12_normandie',
    'bourgogne-franche-comte': 'q12_bourgogne_franche_comte',
    'centre-val-de-loire': 'q12_centre_val_de_loire',
    'corse': 'q12_corse',
    'dom-tom': 'q12_dom_tom',
  },
  q13: {
    'all': 'q13_all',
    'retail': 'q13_retail',
    'industry': 'q13_industry',
    'services': 'q13_services',
    'construction': 'q13_construction',
    'healthcare': 'q13_health',
    'tech': 'q13_tech',
    'environment': 'q13_environment',
    'hospitality': 'q13_hospitality',
    'transport': 'q13_transport',
    'other': 'q13_other',
  },
  q14: {
    '1-3M': 'q14_1_3M',
    '3-5M': 'q14_3_5M',
    '>5M': 'q14_5M_plus',
  },
  q15: {
    majority_without_fund: 'q15_majority_without_fund',
    majority_with_minority: 'q15_majority_with_minority',
    manager_with_majority: 'q15_manager_with_majority',
    havent_thought: 'q15_havent_thought',
  },
  q16: {
    tbd: 'q16_tbd',
    '151-250': 'q16_151_250',
    '251-350': 'q16_251_350',
    '351-450': 'q16_351_450',
    '>450': 'q16_450_plus',
  },
}

const Q17_OPTION_KEYS: Record<string, string> = {
  project_launch: 'q17_project_launch',
  deal_access: 'q17_deal_access',
  partner_access: 'q17_partner_access',
  financing: 'q17_financing',
  other_support: 'q17_other_support',
}

/**
 * Step 6: Review
 * Summary of all answers with edit buttons and submit
 */
export function StepReview({
  data,
  onBack,
  onEditStep,
  onSubmit,
  isSubmitting = false
}: IntakeV2ReviewStepProps) {
  const { t, language } = useLanguage()

  // Get translated label for a single value
  const getTranslatedLabel = (optionKeys: Record<string, string>, value: string) => {
    const key = optionKeys[value]
    return key ? t(key as any) : value
  }

  // Get translated labels for multi-select values
  const getTranslatedLabels = (optionKeys: Record<string, string>, values: string[]) => {
    return values.map(v => getTranslatedLabel(optionKeys, v))
  }

  // Labels for sections
  const labels = language === 'fr' ? {
    title: 'Vérification',
    description: 'Relisez vos réponses avant de soumettre votre candidature.',
    contact: 'Coordonnées',
    profile: 'Profil (WHO)',
    project: 'Projet',
    criteria: 'Critères de recherche (WHEN)',
    needs: 'Besoins',
    edit: 'Modifier',
    name: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    cv: 'CV',
    linkedin: 'LinkedIn',
    uploaded: 'Téléchargé',
    notProvided: 'Non fourni',
    geoZones: 'Zones géographiques',
    sectors: 'Secteurs cibles',
    dealSize: 'Taille de transaction',
    structure: 'Structure capitalistique',
    equity: 'Apport personnel',
    currentNeeds: 'Besoins actuels',
    thesis: 'Lettre de cadrage',
    consentConfirmed: 'Vous avez accepté de recevoir des communications de Re-New.',
    back: 'Retour',
    submit: 'Soumettre ma candidature',
    submitting: 'Envoi en cours...',
    status: 'Statut professionnel',
    experience: 'Expérience',
    leadership: 'Management',
    crisis: 'Gestion de crise',
    investment: 'Décisions d\'investissement',
    impact: 'Impact personnel',
    projectStatus: 'Avancement du projet',
  } : {
    title: 'Review',
    description: 'Review your answers before submitting your application.',
    contact: 'Contact Information',
    profile: 'Profile (WHO)',
    project: 'Project',
    criteria: 'Search Criteria (WHEN)',
    needs: 'Needs',
    edit: 'Edit',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    cv: 'Resume',
    linkedin: 'LinkedIn',
    uploaded: 'Uploaded',
    notProvided: 'Not provided',
    geoZones: 'Geographic zones',
    sectors: 'Target sectors',
    dealSize: 'Deal size',
    structure: 'Capital structure',
    equity: 'Equity contribution',
    currentNeeds: 'Current needs',
    thesis: 'Investment thesis',
    consentConfirmed: 'You have agreed to receive communications from Re-New.',
    back: 'Back',
    submit: 'Submit my application',
    submitting: 'Submitting...',
    status: 'Professional status',
    experience: 'Experience',
    leadership: 'Leadership',
    crisis: 'Crisis management',
    investment: 'Investment decisions',
    impact: 'Personal impact',
    projectStatus: 'Project status',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{labels.title}</h2>
        <p className="text-muted-foreground">
          {labels.description}
        </p>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">{labels.contact}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
            <Pencil className="size-4 mr-1" /> {labels.edit}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div><span className="text-muted-foreground">{labels.name}:</span> {data.first_name} {data.last_name}</div>
          <div><span className="text-muted-foreground">{labels.email}:</span> {data.email}</div>
          <div><span className="text-muted-foreground">{labels.phone}:</span> {data.phone}</div>
          <div><span className="text-muted-foreground">{labels.cv}:</span> {data.cv_url ? <Badge variant="secondary">{labels.uploaded}</Badge> : labels.notProvided}</div>
          {data.linkedin_url && (
            <div><span className="text-muted-foreground">{labels.linkedin}:</span> {data.linkedin_url}</div>
          )}
        </CardContent>
      </Card>

      {/* WHO Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">{labels.profile}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
            <Pencil className="size-4 mr-1" /> {labels.edit}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">{labels.status}</div>
            <div>{getTranslatedLabel(WHO_OPTION_KEYS.q05_status, data.q05_status || '')}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{labels.experience}</div>
            <div>{getTranslatedLabel(WHO_OPTION_KEYS.q06_experience, data.q06_experience || '')}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{labels.leadership}</div>
            <div>{getTranslatedLabel(WHO_OPTION_KEYS.q07_leadership, data.q07_leadership || '')}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{labels.crisis}</div>
            <div>{getTranslatedLabel(WHO_OPTION_KEYS.q08_crisis, data.q08_crisis || '')}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{labels.investment}</div>
            <div>{getTranslatedLabel(WHO_OPTION_KEYS.q09_investment, data.q09_investment || '')}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{labels.impact}</div>
            <div>{getTranslatedLabel(WHO_OPTION_KEYS.q10_impact, data.q10_impact || '')}</div>
          </div>
        </CardContent>
      </Card>

      {/* Project Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">{labels.project}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
            <Pencil className="size-4 mr-1" /> {labels.edit}
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="text-muted-foreground text-xs">{labels.projectStatus}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {getTranslatedLabels(Q11_OPTION_KEYS, data.q11_project_status || []).map((label, i) => (
              <Badge key={i} variant="secondary">{label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WHEN Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">{labels.criteria}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(4)}>
            <Pencil className="size-4 mr-1" /> {labels.edit}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {/* Geo Zones */}
          <div>
            <div className="text-muted-foreground text-xs">{labels.geoZones}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getTranslatedLabels(WHEN_OPTION_KEYS.q12, data.q12_geo_zones || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Sectors */}
          <div>
            <div className="text-muted-foreground text-xs">{labels.sectors}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getTranslatedLabels(WHEN_OPTION_KEYS.q13, data.q13_target_sectors_v2 || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Deal Size */}
          <div>
            <div className="text-muted-foreground text-xs">{labels.dealSize}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getTranslatedLabels(WHEN_OPTION_KEYS.q14, data.q14_deal_size || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Structure */}
          <div>
            <div className="text-muted-foreground text-xs">{labels.structure}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getTranslatedLabels(WHEN_OPTION_KEYS.q15, data.q15_structure || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Equity */}
          <div>
            <div className="text-muted-foreground text-xs">{labels.equity}</div>
            <div>{getTranslatedLabel(WHEN_OPTION_KEYS.q16, data.q16_equity || '')}</div>
          </div>
        </CardContent>
      </Card>

      {/* Needs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">{labels.needs}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(5)}>
            <Pencil className="size-4 mr-1" /> {labels.edit}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">{labels.currentNeeds}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getTranslatedLabels(Q17_OPTION_KEYS, data.q17_current_needs || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">{labels.thesis}</div>
            <div>{data.q18_investment_thesis_url ? <Badge variant="secondary">{labels.uploaded}</Badge> : labels.notProvided}</div>
          </div>
        </CardContent>
      </Card>

      {/* Consent confirmation */}
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md text-sm">
        <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
        <p className="text-green-700 dark:text-green-300">
          {labels.consentConfirmed}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          {labels.back}
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              {labels.submitting}
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </div>
    </div>
  )
}
