'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageToggle } from '@/components/intake-v2/language-toggle'

export default function AssessmentSuccessPage() {
  const { language } = useLanguage()

  const content = language === 'fr' ? {
    title: 'Merci !',
    subtitle: 'Vos reponses ont bien ete enregistrees.',
    description: 'L\'equipe Re-New analysera vos reponses et reviendra vers vous prochainement.',
    cta: 'Visiter re-new.team',
    questions: 'Des questions ? Contactez-nous a',
  } : {
    title: 'Thank you!',
    subtitle: 'Your responses have been recorded.',
    description: 'The Re-New team will analyze your responses and get back to you shortly.',
    cta: 'Visit re-new.team',
    questions: 'Questions? Contact us at',
  }

  return (
    <main id="main-content" className="min-h-svh bg-background px-4 py-16">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-end mb-6">
          <LanguageToggle />
        </div>

        <div className="text-center">
          {/* Success icon */}
          <div className="flex justify-center mb-6">
            <div className="wave-success-confirm flex size-16 items-center justify-center rounded-full border bg-teal-50">
              <CheckCircle2 className="size-8 text-teal-700" />
            </div>
          </div>

          <h1 className="mb-4 text-[28px] font-semibold tracking-[-0.03em]">
            {content.title}
          </h1>

          <p className="text-lg text-muted-foreground mb-2">
            {content.subtitle}
          </p>

          <p className="text-muted-foreground mb-8">
            {content.description}
          </p>

          <Button asChild>
            <Link href="https://re-new.team" target="_blank">
              {content.cta}
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>

          <p className="mt-8 text-sm text-muted-foreground">
            {content.questions}{' '}
            <a href="mailto:contact@re-new.team" className="text-primary hover:underline">
              contact@re-new.team
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
