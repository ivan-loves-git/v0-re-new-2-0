"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const portalSetup = searchParams.get("intent") === "portal"
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: portalSetup
          ? "/auth/reset-password?intent=portal"
          : "/auth/reset-password",
      })

      if (result.error) {
        setError(
          portalSetup
            ? "Impossible d'envoyer un lien pour le moment. Reessayez plus tard."
            : "We couldn't send a reset link right now. Please try again later.",
        )
        return
      }

      setSuccess(true)
    } catch {
      setError(
        portalSetup
          ? "Impossible d'envoyer un lien pour le moment. Reessayez plus tard."
          : "We couldn't send a reset link right now. Please try again later.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      id="main-content"
      className="flex min-h-svh items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8">
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-info/10">
                <Mail className="size-8 text-info" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {portalSetup ? "Verifiez votre e-mail" : "Check your email"}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {portalSetup
                  ? "Si cette adresse est associee a un acces Re-New, un nouveau lien a ete envoye."
                  : "If an account uses this address, a password reset link has been sent."}
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                {portalSetup
                  ? "Verifiez aussi vos courriers indesirables."
                  : "Check your spam folder before requesting another link."}
              </p>
              <Link
                href="/auth/login"
                className="font-medium text-primary hover:underline"
              >
                {portalSetup ? "Retour a la connexion" : "Back to sign in"}
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1 size-4" />
                {portalSetup ? "Retour a la connexion" : "Back to sign in"}
              </Link>

              <p className="wave-eyebrow mb-2">WAVE access</p>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {portalSetup
                  ? "Recevoir un nouveau lien"
                  : "Reset your password"}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {portalSetup
                  ? "Saisissez l'adresse e-mail utilisee pour votre acces Re-New. Si elle est reconnue, nous vous enverrons un nouveau lien."
                  : "Enter your email and, if it is recognized, we'll send you a reset link."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={loading}
                >
                  {loading
                    ? portalSetup
                      ? "Envoi..."
                      : "Sending..."
                    : portalSetup
                      ? "Envoyer un nouveau lien"
                      : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function LoadingFallback() {
  return (
    <main
      id="main-content"
      className="flex min-h-svh items-center justify-center bg-background p-4"
    >
      <Loader2 className="size-8 animate-spin text-primary" />
    </main>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ForgotPasswordContent />
    </Suspense>
  )
}
