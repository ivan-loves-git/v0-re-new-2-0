import { IntakeFormV2 } from '@/components/intake-v2'

export const metadata = {
  title: 'Candidature | Re-New',
  description: 'Rejoignez Re-New et lancez votre projet de reprise d\'entreprise.'
}

/**
 * Public intake form page (v2)
 * New dual-scoring questionnaire
 */
export default function IntakeV2Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Rejoignez Re-New
        </h1>
        <p className="text-muted-foreground">
          Complétez ce formulaire pour démarrer votre parcours de repreneur.
        </p>
      </div>

      {/* Form */}
      <IntakeFormV2 />
    </main>
  )
}
