'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { WHEN_QUESTIONS } from '@/lib/config/questionnaire-v2'
import { useLanguage } from '@/lib/i18n/language-context'
import type { IntakeV2StepProps } from '@/lib/types/intake-v2'
import { Info } from 'lucide-react'

// Translation keys for WHEN questions - values must match WHEN_QUESTIONS in questionnaire-v2.ts
const WHEN_TRANSLATION_MAP: Record<string, { label: string; helpText?: string; options: Record<string, string> }> = {
  q12: {
    label: 'q12Label',
    options: {
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
    }
  },
  q13: {
    label: 'q13Label',
    options: {
      'Agroalimentaire': 'q13_agroalimentaire',
      'Industrie manufacturière': 'q13_manufacturing',
      'Industrie lourde': 'q13_heavy_industry',
      'Industrie pharmaceutique & Dispositifs médicaux': 'q13_pharma_medical',
      'Services de santé': 'q13_health_services',
      'Automobile & Mobilité': 'q13_automotive_mobility',
      'Textile, Luxe & Mode': 'q13_textile_luxury_fashion',
      'Commerce, Négoce & Distribution': 'q13_trade_distribution',
      'BTP & Construction': 'q13_btp_construction',
      'Services aux entreprises (B2B)': 'q13_b2b_services',
      'Services aux particuliers (B2C)': 'q13_b2c_services',
      'Tech & Digital': 'q13_tech_digital',
      'Environnement & Énergie': 'q13_environment_energy',
      'Hôtellerie, Restauration & Loisirs': 'q13_hospitality_leisure',
      'Transport & Logistique': 'q13_transport_logistics',
      'Autre': 'q13_other',
    }
  },
  q14: {
    label: 'q14Label',
    helpText: 'q14HelpText',
    options: {
      '1-3M': 'q14_1_3M',
      '3-5M': 'q14_3_5M',
      '>5M': 'q14_5M_plus',
    }
  },
  q15: {
    label: 'q15Label',
    helpText: 'q15HelpText',
    options: {
      majority_without_fund: 'q15_majority_without_fund',
      majority_with_minority: 'q15_majority_with_minority',
      manager_with_majority: 'q15_manager_with_majority',
      havent_thought: 'q15_havent_thought',
    }
  },
  q16: {
    label: 'q16Label',
    options: {
      tbd: 'q16_tbd',
      '151-250': 'q16_151_250',
      '251-350': 'q16_251_350',
      '351-450': 'q16_351_450',
      '>450': 'q16_450_plus',
    }
  },
}

/**
 * Step 4: WHEN Questions (Q12-Q16)
 * Project maturity assessment - mix of multi-select and single select
 */
export function StepWhen({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
  const { t, language } = useLanguage()

  const updateOptionalNumber = (field: keyof IntakeV2StepProps["data"], value: string) => {
    onChange({ [field]: value === '' ? null : Number(value) })
  }

  const toggleMultiSelect = (field: string, value: string) => {
    const current = (data[field as keyof typeof data] as string[]) || []
    const updated = [...current]
    const index = updated.indexOf(value)

    if (index === -1) {
      updated.push(value)
    } else {
      updated.splice(index, 1)
    }

    onChange({ [field]: updated })
  }

  const isValid = () => {
    return (
      (data.q12_geo_zones?.length || 0) > 0 &&
      (data.q13_target_sectors_v2?.length || 0) > 0 &&
      (data.q14_deal_size?.length || 0) > 0 &&
      (data.q15_structure?.length || 0) > 0 &&
      data.q16_equity?.trim()
    )
  }

  const renderMultiSelect = (
    questionId: keyof Pick<typeof WHEN_QUESTIONS, 'q12' | 'q13' | 'q14' | 'q15'>,
    question: (typeof WHEN_QUESTIONS)[keyof Pick<typeof WHEN_QUESTIONS, 'q12' | 'q13' | 'q14' | 'q15'>],
  ) => {
    const selectedValues = (data[question.field as keyof typeof data] as string[]) || []
    const translationMap = WHEN_TRANSLATION_MAP[questionId]

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {question.options.map((option) => {
          const isSelected = selectedValues.includes(option.value)
          const optionTranslationKey = translationMap.options[option.value]
          return (
            <div
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                  : 'border-border hover:bg-muted/50 hover:border-input'
              }`}
              onClick={() => toggleMultiSelect(question.field, option.value)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleMultiSelect(question.field, option.value)}
                id={`${question.id}-${option.value}`}
              />
              <Label
                htmlFor={`${question.id}-${option.value}`}
                className={`flex-1 cursor-pointer font-normal ${isSelected ? 'text-blue-900' : ''}`}
              >
                {t(optionTranslationKey as any)}
              </Label>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{t('step4Title')}</h2>
        <p className="text-muted-foreground">
          {t('step4Description')}
        </p>
      </div>

      {/* Q12: Geographic Zones */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q12Label')} *
        </Label>
        {renderMultiSelect('q12', WHEN_QUESTIONS.q12)}
        {errors.q12_geo_zones && (
          <p className="text-sm text-red-500">{errors.q12_geo_zones}</p>
        )}
      </div>

      {/* Q13: Target Sectors */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q13Label')} *
        </Label>
        {renderMultiSelect('q13', WHEN_QUESTIONS.q13)}
        {errors.q13_target_sectors_v2 && (
          <p className="text-sm text-red-500">{errors.q13_target_sectors_v2}</p>
        )}
      </div>

      {/* Q14: Deal Size */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q14Label')} *
        </Label>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
          <Info className="size-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-blue-700 dark:text-blue-300">
            {t('q14HelpText')}
          </p>
        </div>
        {renderMultiSelect('q14', WHEN_QUESTIONS.q14)}
        {errors.q14_deal_size && (
          <p className="text-sm text-red-500">{errors.q14_deal_size}</p>
        )}
      </div>

      {/* Q15: Capital Structure */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q15Label')} *
        </Label>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
          <Info className="size-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-blue-700 dark:text-blue-300">
            {t('q15HelpText')}
          </p>
        </div>
        {renderMultiSelect('q15', WHEN_QUESTIONS.q15)}
        {errors.q15_structure && (
          <p className="text-sm text-red-500">{errors.q15_structure}</p>
        )}
      </div>

      {/* Q16: Equity Contribution (Single Select) */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q16Label')} *
        </Label>

        <RadioGroup
          value={data.q16_equity || ''}
          onValueChange={(value) => onChange({ q16_equity: value })}
          className="grid grid-cols-1 md:grid-cols-2 gap-2"
        >
          {WHEN_QUESTIONS.q16.options.map((option) => {
            const isSelected = data.q16_equity === option.value
            const optionTranslationKey = WHEN_TRANSLATION_MAP.q16.options[option.value]
            return (
              <div
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                    : 'border-border hover:bg-muted/50 hover:border-input'
                }`}
                onClick={() => onChange({ q16_equity: option.value })}
              >
                <RadioGroupItem value={option.value} id={`q16-${option.value}`} />
                <Label
                  htmlFor={`q16-${option.value}`}
                  className={`flex-1 cursor-pointer font-normal ${isSelected ? 'text-blue-900' : ''}`}
                >
                  {t(optionTranslationKey as any)}
                </Label>
              </div>
            )
          })}
        </RadioGroup>
        {errors.q16_equity && (
          <p className="text-sm text-red-500">{errors.q16_equity}</p>
        )}
      </div>

      {/* Optional matching criteria. They are stored for opportunity matching, not scoring. */}
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div>
          <Label className="text-base font-medium">
            {language === 'fr' ? 'Critères de matching complémentaires (optionnel)' : 'Additional matching criteria (optional)'}
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === 'fr'
              ? 'Ces réponses aident à comparer votre projet aux opportunités. Elles ne sont pas prises en compte dans votre score.'
              : 'These answers improve opportunity matching. They are not scored.'}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid grid-cols-2 gap-2">
            <Label className="col-span-2 text-sm">{language === 'fr' ? 'Chiffre d’affaires cible (M€)' : 'Target revenue (M EUR)'}</Label>
            <Input aria-label={language === 'fr' ? 'Chiffre d’affaires cible minimum' : 'Minimum target revenue'} type="number" min="0" step="0.1" placeholder="Min" value={data.target_revenue_min_meur ?? ''} onChange={(e) => updateOptionalNumber('target_revenue_min_meur', e.target.value)} />
            <Input aria-label={language === 'fr' ? 'Chiffre d’affaires cible maximum' : 'Maximum target revenue'} type="number" min="0" step="0.1" placeholder="Max" value={data.target_revenue_max_meur ?? ''} onChange={(e) => updateOptionalNumber('target_revenue_max_meur', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">{language === 'fr' ? 'Marge EBITDA mini (%)' : 'Minimum EBITDA margin (%)'}</Label>
            <Input aria-label={language === 'fr' ? 'Marge EBITDA minimale' : 'Minimum EBITDA margin'} type="number" min="0" max="100" step="0.1" placeholder="Min" value={data.target_ebitda_margin_min_pct ?? ''} onChange={(e) => updateOptionalNumber('target_ebitda_margin_min_pct', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Label className="col-span-2 text-sm">{language === 'fr' ? 'Effectif cible' : 'Target staff size'}</Label>
            <Input aria-label={language === 'fr' ? 'Effectif cible minimum' : 'Minimum target staff size'} type="number" min="0" step="1" placeholder="Min" value={data.target_staff_size_min ?? ''} onChange={(e) => updateOptionalNumber('target_staff_size_min', e.target.value)} />
            <Input aria-label={language === 'fr' ? 'Effectif cible maximum' : 'Maximum target staff size'} type="number" min="0" step="1" placeholder="Max" value={data.target_staff_size_max ?? ''} onChange={(e) => updateOptionalNumber('target_staff_size_max', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button onClick={onNext} disabled={!isValid()}>
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
