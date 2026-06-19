"use client"

import { Suspense, useState, useEffect } from "react"
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
  const [tokenError, setTokenError] = useState(false)

  const token = searchParams.get("token")
  const isPortalSetup = searchParams.get("intent") === "portal"

  useEffect(() => {
    if (!token) {
      setTokenError(true)
    }
  }, [token])

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
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-background rounded-2xl shadow-sm border border-border p-8 text-center">
            <div className="size-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="size-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Invalid link
            </h1>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Link
              href="/auth/forgot-password"
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-background rounded-2xl shadow-sm border border-border p-8">
          {success ? (
            <div className="text-center">
              <div className="size-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="size-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {isPortalSetup ? "Mot de passe cree" : "Password reset"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {isPortalSetup
                  ? "Votre acces est pret. Vous pouvez maintenant vous connecter a la plateforme Re-New."
                  : "Your password has been successfully reset."}
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center w-full h-11 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md"
              >
                {isPortalSetup ? "Se connecter" : "Sign in"}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
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
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-border focus:border-blue-500 focus:ring-blue-500"
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
                    type="password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-border focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white font-medium"
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
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-background rounded-2xl shadow-sm border border-border p-8 text-center">
          <Loader2 className="size-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
