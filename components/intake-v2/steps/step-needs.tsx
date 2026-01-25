'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { NEEDS_QUESTIONS } from '@/lib/config/questionnaire-v2'
import { TEST_NEEDS_DATA, SHOW_AUTOFILL } from '@/lib/config/intake-test-data'
import type { IntakeV2StepProps, FileUploadState } from '@/lib/types/intake-v2'
import { Upload, FileText, X, Loader2, Info, Zap } from 'lucide-react'

/**
 * Step 5: Needs Assessment (Q17-Q18)
 * Current needs multi-select + optional thesis upload + consent
 */
export function StepNeeds({ data, onChange, onNext, onBack, errors = {} }: IntakeV2StepProps) {
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
      setThesisUpload(prev => ({ ...prev, error: 'Format non accepté. Utilisez PDF, DOC ou DOCX.' }))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setThesisUpload(prev => ({ ...prev, error: 'Fichier trop volumineux. Maximum 10MB.' }))
      return
    }

    setThesisUpload(prev => ({ ...prev, file, uploading: true, error: null }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'thesis')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const { url } = await response.json()
      setThesisUpload(prev => ({ ...prev, uploading: false, url }))
      onChange({ q18_investment_thesis_url: url })
    } catch {
      setThesisUpload(prev => ({ ...prev, uploading: false, error: 'Erreur lors du téléchargement' }))
    }
  }

  const removeFile = () => {
    setThesisUpload({ file: null, uploading: false, progress: 0, url: null, error: null })
    onChange({ q18_investment_thesis_url: null })
  }

  const isValid = () => {
    return selectedNeeds.length > 0 && data.marketing_consent === true
  }

  const handleAutofill = () => {
    onChange(TEST_NEEDS_DATA)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Vos besoins</h2>
          <p className="text-muted-foreground">
            Dites-nous comment nous pouvons vous accompagner.
          </p>
        </div>
        {SHOW_AUTOFILL && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutofill}
            className="shrink-0 text-xs bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800"
          >
            <Zap className="h-3 w-3 mr-1" />
            Remplir cette étape
          </Button>
        )}
      </div>

      {/* Q17: Current Needs */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {NEEDS_QUESTIONS.q17.label} *
        </Label>

        <div className="space-y-2">
          {NEEDS_QUESTIONS.q17.options.map((option) => {
            const isSelected = selectedNeeds.includes(option.value)
            return (
              <div
                key={option.value}
                className={`flex items-center space-x-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
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
                  {option.label}
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
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {NEEDS_QUESTIONS.q18.label}
        </Label>
        <p className="text-sm text-muted-foreground">{NEEDS_QUESTIONS.q18.helpText}</p>

        {thesisUpload.url ? (
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">Document téléchargé</span>
            <Button variant="ghost" size="sm" onClick={removeFile}>
              <X className="h-4 w-4" />
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
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {thesisUpload.uploading ? 'Téléchargement...' : 'Cliquez ou déposez votre document ici (optionnel)'}
              </span>
            </div>
          </div>
        )}
        {thesisUpload.error && (
          <p className="text-sm text-red-500">{thesisUpload.error}</p>
        )}
      </div>

      {/* Marketing Consent */}
      <div className="space-y-3 p-4 border rounded-md bg-muted/30">
        <div
          className="flex items-start space-x-3 cursor-pointer"
          onClick={() => onChange({ marketing_consent: !data.marketing_consent })}
        >
          <Checkbox
            checked={data.marketing_consent || false}
            onCheckedChange={(checked) => onChange({ marketing_consent: checked as boolean })}
            id="marketing_consent"
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="marketing_consent" className="cursor-pointer font-medium">
              J'accepte de recevoir des communications de Re-New *
            </Label>
            <p className="text-sm text-muted-foreground">
              En cochant cette case, vous acceptez que Re-New vous contacte par email concernant
              votre projet de reprise et les services proposés. Vous pouvez vous désinscrire à tout moment.
            </p>
          </div>
        </div>
        {errors.marketing_consent && (
          <p className="text-sm text-red-500">{errors.marketing_consent}</p>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm">
        <Info className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-amber-700 dark:text-amber-300">
          Vos données sont protégées conformément au RGPD. Consultez notre politique de confidentialité pour plus d'informations.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!isValid()}>
          Vérifier mes réponses
        </Button>
      </div>
    </div>
  )
}
