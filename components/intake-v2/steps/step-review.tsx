'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  WHO_QUESTIONS,
  PROJECT_STATUS_QUESTION,
  WHEN_QUESTIONS,
  NEEDS_QUESTIONS
} from '@/lib/config/questionnaire-v2'
import type { IntakeV2ReviewStepProps } from '@/lib/types/intake-v2'
import { Pencil, CheckCircle2, Loader2 } from 'lucide-react'

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

  const getOptionLabel = (options: readonly { value: string; label: string }[], value: string) => {
    return options.find(o => o.value === value)?.label || value
  }

  const getMultiSelectLabels = (options: readonly { value: string; label: string }[], values: string[]) => {
    return values.map(v => getOptionLabel(options, v))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Vérification</h2>
        <p className="text-muted-foreground">
          Relisez vos réponses avant de soumettre votre candidature.
        </p>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Coordonnées</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Nom:</span> {data.first_name} {data.last_name}</div>
          <div><span className="text-muted-foreground">Email:</span> {data.email}</div>
          <div><span className="text-muted-foreground">Téléphone:</span> {data.phone}</div>
          <div><span className="text-muted-foreground">CV:</span> {data.cv_url ? <Badge variant="secondary">Téléchargé</Badge> : 'Non fourni'}</div>
          {data.linkedin_url && (
            <div><span className="text-muted-foreground">LinkedIn:</span> {data.linkedin_url}</div>
          )}
        </CardContent>
      </Card>

      {/* WHO Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Profil (WHO)</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {Object.values(WHO_QUESTIONS).map((q) => {
            const value = data[q.field as keyof typeof data] as string
            return (
              <div key={q.id}>
                <div className="text-muted-foreground text-xs">{q.label}</div>
                <div>{getOptionLabel(q.options, value)}</div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Project Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Projet</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="text-muted-foreground text-xs">{PROJECT_STATUS_QUESTION.q11.label}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {getMultiSelectLabels(PROJECT_STATUS_QUESTION.q11.options, data.q11_project_status || []).map((label, i) => (
              <Badge key={i} variant="secondary">{label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WHEN Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Critères de recherche (WHEN)</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(4)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Geo Zones */}
          <div>
            <div className="text-muted-foreground text-xs">Zones géographiques</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getMultiSelectLabels(WHEN_QUESTIONS.q12.options, data.q12_geo_zones || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Sectors */}
          <div>
            <div className="text-muted-foreground text-xs">Secteurs cibles</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getMultiSelectLabels(WHEN_QUESTIONS.q13.options, data.q13_target_sectors_v2 || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Deal Size */}
          <div>
            <div className="text-muted-foreground text-xs">Taille de transaction</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getMultiSelectLabels(WHEN_QUESTIONS.q14.options, data.q14_deal_size || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Structure */}
          <div>
            <div className="text-muted-foreground text-xs">Structure capitalistique</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getMultiSelectLabels(WHEN_QUESTIONS.q15.options, data.q15_structure || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>

          {/* Equity */}
          <div>
            <div className="text-muted-foreground text-xs">Apport personnel</div>
            <div>{getOptionLabel(WHEN_QUESTIONS.q16.options, data.q16_equity || '')}</div>
          </div>
        </CardContent>
      </Card>

      {/* Needs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Besoins</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(5)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifier
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Besoins actuels</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {getMultiSelectLabels(NEEDS_QUESTIONS.q17.options, data.q17_current_needs || []).map((label, i) => (
                <Badge key={i} variant="secondary">{label}</Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Lettre de cadrage</div>
            <div>{data.q18_investment_thesis_url ? <Badge variant="secondary">Téléchargé</Badge> : 'Non fourni'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Consent confirmation */}
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <p className="text-green-700 dark:text-green-300">
          Vous avez accepté de recevoir des communications de Re-New.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Retour
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            'Soumettre ma candidature'
          )}
        </Button>
      </div>
    </div>
  )
}
