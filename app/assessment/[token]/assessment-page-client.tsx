'use client'

import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageToggle } from '@/components/intake-v2/language-toggle'
import { AssessmentForm } from '@/components/assessment/assessment-form'
import { AlertCircle, CheckCircle2, Waves } from 'lucide-react'
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
      <main id="main-content" className="min-h-svh bg-background px-4 py-16">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-end mb-6">
            <LanguageToggle />
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="flex size-16 items-center justify-center rounded-full border bg-red-50">
                <AlertCircle className="size-8 text-red-700" />
              </div>
            </div>
            <h1 className="mb-4 text-[28px] font-semibold tracking-[-0.03em]">{content.title}</h1>
            <p className="mb-8 text-base leading-7 text-muted-foreground">{content.description}</p>
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
      <main id="main-content" className="min-h-svh bg-background px-4 py-16">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-end mb-6">
            <LanguageToggle />
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="flex size-16 items-center justify-center rounded-full border bg-teal-50">
                <CheckCircle2 className="size-8 text-teal-700" />
              </div>
            </div>
            <h1 className="mb-4 text-[28px] font-semibold tracking-[-0.03em]">{content.title}</h1>
            <p className="mb-8 text-base leading-7 text-muted-foreground">{content.description}</p>
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
    <main id="main-content" className="min-h-svh bg-background px-4 py-6 md:py-10">
      <div className="mx-auto mb-8 max-w-2xl border-b pb-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-[#081020] text-[#7dd3c7]"><Waves className="size-[18px]" /></span><span className="text-xs font-semibold tracking-[0.12em]">WAVE</span></div>
          <LanguageToggle />
        </div>
        <div className="text-center">
          <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.03em]">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <AssessmentForm token={token} repreneurName={repreneurName} />
    </main>
  )
}
