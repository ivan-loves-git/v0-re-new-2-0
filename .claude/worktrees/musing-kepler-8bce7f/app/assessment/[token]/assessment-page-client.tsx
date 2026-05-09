'use client'

import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageToggle } from '@/components/intake-v2/language-toggle'
import { AssessmentForm } from '@/components/assessment/assessment-form'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface AssessmentPageClientProps {
  status: 'not_found' | 'completed' | 'valid'
  token: string
  repreneurName?: string
}

export function AssessmentPageClient({ status, token, repreneurName }: AssessmentPageClientProps) {
  const { language } = useLanguage()

  if (status === 'not_found') {
    const content = language === 'fr' ? {
      title: 'Assessment introuvable',
      description: 'Ce lien n\'est pas valide ou a expire. Veuillez contacter l\'equipe Re-New si vous pensez qu\'il s\'agit d\'une erreur.',
      cta: 'Visiter re-new.team',
    } : {
      title: 'Assessment not found',
      description: 'This link is not valid or has expired. Please contact the Re-New team if you believe this is an error.',
      cta: 'Visit re-new.team',
    }

    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-end mb-6">
            <LanguageToggle />
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="size-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="size-10 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-4">{content.title}</h1>
            <p className="text-lg text-muted-foreground mb-8">{content.description}</p>
            <Button asChild>
              <Link href="https://re-new.team" target="_blank">{content.cta}</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (status === 'completed') {
    const content = language === 'fr' ? {
      title: 'Assessment deja complete',
      description: 'Cet assessment a deja ete soumis. Merci pour votre participation !',
      cta: 'Visiter re-new.team',
    } : {
      title: 'Assessment already completed',
      description: 'This assessment has already been submitted. Thank you for your participation!',
      cta: 'Visit re-new.team',
    }

    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-end mb-6">
            <LanguageToggle />
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="size-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-4">{content.title}</h1>
            <p className="text-lg text-muted-foreground mb-8">{content.description}</p>
            <Button asChild>
              <Link href="https://re-new.team" target="_blank">{content.cta}</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // Valid assessment — show the form
  const title = language === 'fr' ? 'Assessment Leadership' : 'Leadership Assessment'
  const subtitle = repreneurName
    ? (language === 'fr' ? `Bienvenue, ${repreneurName}` : `Welcome, ${repreneurName}`)
    : undefined

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <AssessmentForm token={token} repreneurName={repreneurName} />
    </main>
  )
}
