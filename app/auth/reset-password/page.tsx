"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const token = searchParams.get("token")
  const isPortalSetup = searchParams.get("intent") === "portal"

  const tokenError = !token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: token!,
      })

      if (result.error) {
        setError(result.error.message || "Failed to reset password")
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred")
      setLoading(false)
    }
  }

  if (tokenError) {
    return (
      <main id="main-content" className="flex min-h-svh items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-card p-8 text-center">
            <div className="size-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="size-8 text-destructive" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
              Invalid link
            </h1>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Link
              href="/auth/forgot-password"
              className="font-medium text-primary hover:underline"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8">
          {success ? (
            <div className="text-center">
              <div className="size-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="size-8 text-success" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {isPortalSetup ? "Mot de passe cree" : "Password reset"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {isPortalSetup
                  ? "Votre acces est pret. Vous pouvez maintenant vous connecter a la plateforme Re-New."
                  : "Your password has been successfully reset."}
              </p>
              <Link
                href="/auth/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground hover:bg-[#1859bd]"
              >
                {isPortalSetup ? "Se connecter" : "Sign in"}
              </Link>
            </div>
          ) : (
            <>
              <p className="wave-eyebrow mb-2">WAVE access</p>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {isPortalSetup
                  ? "Creer votre mot de passe"
                  : "Set new password"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {isPortalSetup
                  ? "Choisissez le mot de passe qui vous permettra d'acceder a la plateforme Re-New."
                  : "Enter your new password below."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    {isPortalSetup ? "Mot de passe" : "New password"}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    {isPortalSetup
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
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    ? isPortalSetup
                      ? "Enregistrement..."
                      : "Resetting..."
                    : isPortalSetup
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

function LoadingFallback() {
  return (
    <main id="main-content" className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
