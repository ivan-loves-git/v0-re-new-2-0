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
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-16 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-end mb-6">
          <LanguageToggle />
        </div>

        <div className="text-center">
          {/* Success icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-4">
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
              <ArrowRight className="w-4 h-4 ml-2" />
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
