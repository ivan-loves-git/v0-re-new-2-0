'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { NEEDS_QUESTIONS } from '@/lib/config/questionnaire-v2'
import { useLanguage } from '@/lib/i18n/language-context'
import type { IntakeV2StepProps, FileUploadState } from '@/lib/types/intake-v2'
import { Upload, FileText, X, Loader2, Info } from 'lucide-react'

// Translation keys for Q17 options - values must match NEEDS_QUESTIONS in questionnaire-v2.ts
const Q17_TRANSLATION_MAP: Record<string, string> = {
  project_launch: 'q17_project_launch',
  deal_access: 'q17_deal_access',
  partner_access: 'q17_partner_access',
  financing: 'q17_financing',
  other_support: 'q17_other_support',
}

/**
 * Step 5: Needs Assessment (Q17-Q18)
 * Current needs multi-select + optional thesis upload + consent
 */
export function StepNeeds({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
  const { t } = useLanguage()
  const [thesisUpload, setThesisUpload] = useState<FileUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    url: data.q18_investment_thesis_url || null,
    error: null
  })

  const selectedNeeds = data.q17_current_needs || []

  const toggleNeed = (value: string) => {
    const current = [...selectedNeeds]
    const index = current.indexOf(value)

    if (index === -1) {
      current.push(value)
    } else {
      current.splice(index, 1)
    }

    onChange({ q17_current_needs: current })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(file.type)) {
      setThesisUpload(prev => ({ ...prev, error: t('errorFileType') }))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setThesisUpload(prev => ({ ...prev, error: t('errorFileSize') }))
      return
    }

    setThesisUpload(prev => ({ ...prev, file, uploading: true, error: null }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', 'ldc')

      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const { url } = await response.json()
      setThesisUpload(prev => ({ ...prev, uploading: false, url }))
      onChange({ q18_investment_thesis_url: url })
    } catch {
      setThesisUpload(prev => ({ ...prev, uploading: false, error: t('errorUpload') }))
    }
  }

  const removeFile = () => {
    setThesisUpload({ file: null, uploading: false, progress: 0, url: null, error: null })
    onChange({ q18_investment_thesis_url: null })
  }

  const isValid = () => {
    return selectedNeeds.length > 0 && data.marketing_consent === true
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{t('step5Title')}</h2>
        <p className="text-muted-foreground">
          {t('step5Description')}
        </p>
      </div>

      {/* Q17: Current Needs */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q17Label')} *
        </Label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {NEEDS_QUESTIONS.q17.options.map((option) => {
            const isSelected = selectedNeeds.includes(option.value)
            const optionTranslationKey = Q17_TRANSLATION_MAP[option.value]
            return (
              <div
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                    : 'border-border hover:bg-muted/50 hover:border-input'
                }`}
                onClick={() => toggleNeed(option.value)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleNeed(option.value)}
                  id={`q17-${option.value}`}
                />
                <Label
                  htmlFor={`q17-${option.value}`}
                  className={`flex-1 cursor-pointer font-normal ${isSelected ? 'text-blue-900' : ''}`}
                >
                  {t(optionTranslationKey as any)}
                </Label>
              </div>
            )
          })}
        </div>
        {errors.q17_current_needs && (
          <p className="text-sm text-red-500">{errors.q17_current_needs}</p>
        )}
      </div>

      {/* Q18: Investment Thesis Upload (Optional) */}
      <div className="flex flex-col gap-3">
        <Label className="text-base font-medium">
          {t('q18Label')}
        </Label>
        <p className="text-sm text-muted-foreground">{t('q18HelpText')}</p>

        {thesisUpload.url ? (
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
            <FileText className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">{t('documentUploaded')}</span>
            <Button variant="ghost" size="sm" onClick={removeFile}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={thesisUpload.uploading}
            />
            <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md hover:border-primary/50 transition-colors">
              {thesisUpload.uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {thesisUpload.uploading ? t('uploading') : t('thesisUploadText')}
              </span>
            </div>
          </div>
        )}
        {thesisUpload.error && (
          <p className="text-sm text-red-500">{thesisUpload.error}</p>
        )}
      </div>

      {/* Marketing Consent */}
      <div className="flex flex-col gap-3 p-4 border rounded-md bg-muted/30">
        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => onChange({ marketing_consent: !data.marketing_consent })}
        >
          <Checkbox
            checked={data.marketing_consent || false}
            onCheckedChange={(checked) => onChange({ marketing_consent: checked as boolean })}
            id="marketing_consent"
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="marketing_consent" className="cursor-pointer font-medium">
              {t('marketingConsent')} *
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('marketingConsentDescription')}
            </p>
          </div>
        </div>
        {errors.marketing_consent && (
          <p className="text-sm text-red-500">{errors.marketing_consent}</p>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm">
        <Info className="size-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-amber-700 dark:text-amber-300">
          {t('gdprNotice')}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button onClick={onNext} disabled={!isValid()}>
          {t('review')}
        </Button>
      </div>
    </div>
  )
}
