import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Candidature envoyée | Re-New',
  description: 'Merci pour votre candidature. Nous vous recontacterons bientôt.'
}

/**
 * Success page after intake form submission
 */
export default function IntakeSuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-16 px-4">
      <div className="max-w-lg mx-auto text-center">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold tracking-tight mb-4">
          Merci pour votre candidature !
        </h1>

        <p className="text-lg text-muted-foreground mb-8">
          Nous avons bien reçu votre dossier et nous l'étudions avec attention.
        </p>

        {/* Next steps */}
        <div className="bg-card border rounded-lg p-6 text-left mb-8">
          <h2 className="font-semibold mb-4">Prochaines étapes</h2>

          <div className="space-y-4">
            <div className="flex gap-3">
              <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Email de confirmation</p>
                <p className="text-sm text-muted-foreground">
                  Vous allez recevoir un email de confirmation dans les prochaines minutes.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Calendar className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Prise de contact</p>
                <p className="text-sm text-muted-foreground">
                  Un membre de notre équipe vous contactera sous 48-72h pour un premier échange.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            En attendant, découvrez notre approche et nos services.
          </p>

          <Button asChild>
            <Link href="https://re-new.team" target="_blank">
              Visiter re-new.team
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Contact */}
        <p className="mt-8 text-sm text-muted-foreground">
          Des questions ? Contactez-nous à{' '}
          <a href="mailto:contact@re-new.team" className="text-primary hover:underline">
            contact@re-new.team
          </a>
        </p>
      </div>
    </main>
  )
}
