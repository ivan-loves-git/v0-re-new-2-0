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
import { LanguageToggle } from "@/components/intake-v2/language-toggle"
import { useUiCopy } from "@/components/i18n/ui-text"

function ForgotPasswordContent() {
  const u = useUiCopy()
  const searchParams = useSearchParams()
  const portalSetup = searchParams.get("intent") === "portal"
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(false)
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: portalSetup
          ? "/auth/reset-password?intent=portal"
          : "/auth/reset-password",
      })

      if (result.error) {
        setError(true)
        return
      }

      setSuccess(true)
    } catch {
      setError(true)
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
        <div className="mb-3 flex justify-end"><LanguageToggle /></div>
        <div className="rounded-lg border bg-card p-8">
          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-info/10">
                <Mail className="size-8 text-info" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {u("Check your email")}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {u(portalSetup ? "If this address is linked to Re-New access, a new link has been sent." : "If an account uses this address, a password reset link has been sent.")}
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                {u(portalSetup ? "Check your junk folder too." : "Check your spam folder before requesting another link.")}
              </p>
              <Link
                href="/auth/login"
                className="font-medium text-primary hover:underline"
              >
                {u("Back to sign in")}
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1 size-4" />
                {u("Back to sign in")}
              </Link>

              <p className="wave-eyebrow mb-2">{u("WAVE access")}</p>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {u(portalSetup ? "Get a new access link" : "Reset your password")}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {u(portalSetup ? "Enter the email address used for your Re-New access. If recognized, we will send a new link." : "Enter your email and, if it is recognized, we'll send you a reset link.")}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    {u("Email")}
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
                    <AlertDescription>{u("We couldn't send a reset link right now. Please try again later.")}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={loading}
                >
                  {u(loading ? "Sending..." : portalSetup ? "Send a new link" : "Send reset link")}
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
