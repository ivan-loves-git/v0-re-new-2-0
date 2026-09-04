"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ResetPasswordFormProps {
  token: string | null
  isLinkValid: boolean
  portalSetup: boolean
}

function scrubResetTokenFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has("token")) return

  url.searchParams.delete("token")
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  )
}

function InvalidLink({ portalSetup }: { portalSetup: boolean }) {
  const recoveryHref = portalSetup
    ? "/auth/forgot-password?intent=portal"
    : "/auth/forgot-password"

  return (
    <main
      id="main-content"
      className="flex min-h-svh items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="size-8 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
            {portalSetup ? "Lien d'acces indisponible" : "Invalid link"}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {portalSetup
              ? "Ce lien d'acces est invalide, a expire ou a deja ete utilise. Demandez un nouveau lien pour continuer."
              : "This password reset link is invalid, expired, or has already been used. Request a new link to continue."}
          </p>
          <Link
            href={recoveryHref}
            className="font-medium text-primary hover:underline"
          >
            {portalSetup ? "Demander un nouveau lien" : "Request a new link"}
          </Link>
        </div>
      </div>
    </main>
  )
}

export function ResetPasswordForm({
  token,
  isLinkValid,
  portalSetup,
}: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [linkFailed, setLinkFailed] = useState(false)

  useEffect(() => {
    // Keep a valid, unconsumed token available for an ordinary reload. Once
    // the server has rejected it, remove it from browser history as well.
    if (!isLinkValid) scrubResetTokenFromUrl()

    const refreshAfterHistoryRestore = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh()
    }
    window.addEventListener("pageshow", refreshAfterHistoryRestore)
    return () =>
      window.removeEventListener("pageshow", refreshAfterHistoryRestore)
  }, [isLinkValid, router])

  if (!isLinkValid || !token || linkFailed) {
    return <InvalidLink portalSetup={portalSetup} />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(
        portalSetup
          ? "Les mots de passe ne correspondent pas."
          : "Passwords don't match.",
      )
      return
    }

    if (password.length < 8) {
      setError(
        portalSetup
          ? "Le mot de passe doit contenir au moins 8 caracteres."
          : "Password must be at least 8 characters.",
      )
      return
    }

    setLoading(true)

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        if (result.error.code === "INVALID_TOKEN") {
          scrubResetTokenFromUrl()
          setLinkFailed(true)
          return
        }

        setError(
          portalSetup
            ? "Impossible de terminer maintenant. Reessayez dans quelques instants."
            : "We couldn't finish the password reset. Please try again in a moment.",
        )
        return
      }

      scrubResetTokenFromUrl()
      setSuccess(true)
    } catch {
      setError(
        portalSetup
          ? "Impossible de terminer maintenant. Reessayez dans quelques instants."
          : "We couldn't finish the password reset. Please try again in a moment.",
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
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="size-8 text-success" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {portalSetup ? "Mot de passe cree" : "Password reset"}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {portalSetup
                  ? "Votre acces est pret. Vous pouvez maintenant vous connecter a la plateforme Re-New."
                  : "Your password has been successfully reset."}
              </p>
              <Link
                href="/auth/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground hover:bg-[#1859bd]"
              >
                {portalSetup ? "Se connecter" : "Sign in"}
              </Link>
            </div>
          ) : (
            <>
              <p className="wave-eyebrow mb-2">WAVE access</p>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {portalSetup
                  ? "Creer votre mot de passe"
                  : "Set new password"}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {portalSetup
                  ? "Choisissez le mot de passe qui vous permettra d'acceder a la plateforme Re-New."
                  : "Enter your new password below."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    {portalSetup ? "Mot de passe" : "New password"}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-foreground"
                  >
                    {portalSetup
                      ? "Confirmer le mot de passe"
                      : "Confirm password"}
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
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
                      ? "Enregistrement..."
                      : "Resetting..."
                    : portalSetup
                      ? "Creer mon mot de passe"
                      : "Reset password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
