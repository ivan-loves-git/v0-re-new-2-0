'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/language-context'
import { LanguageToggle } from '@/components/intake-v2/language-toggle'

/**
 * Success page after intake form submission
 */
export default function IntakeSuccessPage() {
  const { language } = useLanguage()

  // Site URL is locale-aware: French applicants land on /fr (the marketing site
  // serves an English version by default), English applicants stay on the root.
  const siteUrl = language === 'fr' ? 'https://re-new.team/fr' : 'https://re-new.team'

  const content = language === 'fr' ? {
    title: 'Merci pour votre candidature !',
    subtitle: 'Nous avons bien reçu votre dossier et nous l\'étudions avec attention.',
    nextSteps: 'Prochaines étapes',
    emailTitle: 'Email de confirmation',
    emailDesc: 'Vous allez recevoir un email de confirmation dans les prochaines minutes.',
    contactTitle: 'Prise de contact',
    contactDesc: 'Un membre de notre équipe vous contactera sous 48-72h pour un premier échange.',
    meanwhile: 'En attendant, découvrez notre approche et nos services.',
    visitSite: 'Visiter re-new.team',
    questions: 'Des questions ? Contactez-nous à',
  } : {
    title: 'Thank you for your application!',
    subtitle: 'We have received your application and are reviewing it carefully.',
    nextSteps: 'Next steps',
    emailTitle: 'Confirmation email',
    emailDesc: 'You will receive a confirmation email in the next few minutes.',
    contactTitle: 'Contact',
    contactDesc: 'A member of our team will contact you within 48-72 hours for an initial conversation.',
    meanwhile: 'In the meantime, discover our approach and services.',
    visitSite: 'Visit re-new.team',
    questions: 'Questions? Contact us at',
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-16 px-4">
      <div className="max-w-lg mx-auto">
        {/* Language toggle */}
        <div className="flex justify-end mb-6">
          <LanguageToggle />
        </div>

        <div className="text-center">
          {/* Success icon */}
          <div className="flex justify-center mb-6">
            <div className="size-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            {content.title}
          </h1>

          <p className="text-lg text-muted-foreground mb-8">
            {content.subtitle}
          </p>

          {/* Next steps */}
          <div className="bg-card border rounded-lg p-6 text-left mb-8">
            <h2 className="font-semibold mb-4">{content.nextSteps}</h2>

            <div className="space-y-4">
              <div className="flex gap-3">
                <Mail className="size-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{content.emailTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {content.emailDesc}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Calendar className="size-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{content.contactTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {content.contactDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {content.meanwhile}
            </p>

            <Button asChild>
              <Link href={siteUrl} target="_blank">
                {content.visitSite}
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Contact */}
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
