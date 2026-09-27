"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
  isPasswordResetToken,
  PASSWORD_RESET_BROWSER_PATH,
  PASSWORD_RESET_PREFLIGHT_PATH,
  PASSWORD_RESET_TOKEN_STORAGE_KEY,
} from "@/lib/password-reset-token"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LanguageToggle } from "@/components/intake-v2/language-toggle"
import { useUiCopy } from "@/components/i18n/ui-text"
import type { UiCopyKey } from "@/lib/i18n/ui-copy"

interface ResetPasswordFormProps {
  portalSetup: boolean
}

type LinkState = "validating" | "valid" | "invalid"

function scrubResetTokenFromUrl() {
  const url = new URL(window.location.href)
  if (url.pathname !== PASSWORD_RESET_BROWSER_PATH) return
  url.searchParams.delete("token")
  url.hash = ""
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}`,
  )
}

function clearStoredResetToken() {
  try {
    window.sessionStorage.removeItem(PASSWORD_RESET_TOKEN_STORAGE_KEY)
  } catch {
    // The URL is still scrubbed and the flow fails closed below.
  }
}

function captureResetToken() {
  const url = new URL(window.location.href)
  const fragmentToken = new URLSearchParams(url.hash.slice(1)).get("token")

  // Query-token links are intentionally retired. A production preflight
  // confirmed there were no unexpired legacy links at cutover.
  const hasRetiredQueryToken = url.searchParams.has("token")
  let storedToken: string | null = null
  try {
    storedToken = window.sessionStorage.getItem(
      PASSWORD_RESET_TOKEN_STORAGE_KEY,
    )
  } catch {
    storedToken = null
  }

  const token = hasRetiredQueryToken ? null : (fragmentToken ?? storedToken)
  scrubResetTokenFromUrl()

  if (!isPasswordResetToken(token)) {
    clearStoredResetToken()
    return null
  }

  try {
    window.sessionStorage.setItem(PASSWORD_RESET_TOKEN_STORAGE_KEY, token)
  } catch {
    clearStoredResetToken()
    return null
  }

  return token
}

function InvalidLink({ portalSetup }: { portalSetup: boolean }) {
  const u = useUiCopy()
  const recoveryHref = portalSetup
    ? "/auth/forgot-password?intent=portal"
    : "/auth/forgot-password"

  return (
    <main
      id="main-content"
      className="flex min-h-svh items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-end"><LanguageToggle /></div>
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="size-8 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
            {u(portalSetup ? "Access link unavailable" : "Invalid link")}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {u(portalSetup ? "This access link is invalid, expired, or already used. Request a new link to continue." : "This password reset link is invalid, expired, or has already been used. Request a new link to continue.")}
          </p>
          <Link
            href={recoveryHref}
            className="font-medium text-primary hover:underline"
          >
            {u("Request a new link")}
          </Link>
        </div>
      </div>
    </main>
  )
}

export function ResetPasswordForm({ portalSetup }: ResetPasswordFormProps) {
  const u = useUiCopy()
  const [token, setToken] = useState<string | null>(null)
  const [linkState, setLinkState] = useState<LinkState>("validating")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<UiCopyKey | null>(null)
  const [success, setSuccess] = useState(false)
  const preflightStarted = useRef(false)
  const componentActive = useRef(false)
  const invalidateLink = useCallback(() => {
    clearStoredResetToken()
    scrubResetTokenFromUrl()
    setToken(null)
    setLinkState("invalid")
  }, [])

  useEffect(() => {
    componentActive.current = true
    const deactivate = () => {
      componentActive.current = false
    }

    // React development mode replays effects once. Keep the preflight
    // non-consuming and single-shot without persisting anything cross-tab.
    if (preflightStarted.current) return deactivate
    preflightStarted.current = true

    const candidate = captureResetToken()
    if (!candidate) {
      queueMicrotask(() => {
        if (componentActive.current) invalidateLink()
      })
      return deactivate
    }

    void (async () => {
      try {
        const response = await fetch(PASSWORD_RESET_PREFLIGHT_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: candidate }),
          cache: "no-store",
          credentials: "same-origin",
          referrerPolicy: "no-referrer",
        })
        const result = (await response.json()) as { valid?: unknown }
        if (!componentActive.current) return
        if (!response.ok || result.valid !== true) {
          invalidateLink()
          return
        }
        setToken(candidate)
        setLinkState("valid")
      } catch {
        if (componentActive.current) invalidateLink()
      }
    })()
    return deactivate
  }, [invalidateLink])

  if (linkState === "validating") {
    return (
      <main
        id="main-content"
        className="flex min-h-svh items-center justify-center bg-background p-4"
      >
        <div className="w-full max-w-md">
          <div className="mb-3 flex justify-end"><LanguageToggle /></div>
          <div className="rounded-lg border bg-card p-8 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{u("Validating link...")}</p>
          </div>
        </div>
      </main>
    )
  }

  if (!success && (linkState === "invalid" || !token)) {
    return <InvalidLink portalSetup={portalSetup} />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const submittedToken = token

    if (!submittedToken) {
      invalidateLink()
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setLoading(true)

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: submittedToken,
      })

      if (result.error) {
        if (result.error.code === "INVALID_TOKEN") {
          invalidateLink()
          return
        }

        setError("We couldn't finish the password reset. Please try again in a moment.")
        return
      }

      clearStoredResetToken()
      scrubResetTokenFromUrl()
      setToken(null)
      setSuccess(true)
    } catch {
      setError("We couldn't finish the password reset. Please try again in a moment.")
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
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="size-8 text-success" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {u(portalSetup ? "Password created" : "Password reset")}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {u(portalSetup ? "Your access is ready. You can now sign in to Re-New." : "Your password has been successfully reset.")}
              </p>
              <Link
                href="/auth/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground hover:bg-[#1859bd]"
              >
                {u("Sign in")}
              </Link>
            </div>
          ) : (
            <>
              <p className="wave-eyebrow mb-2">{u("WAVE access")}</p>
              <h1 className="mb-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                {u(portalSetup ? "Create your password" : "Set new password")}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {u(portalSetup ? "Choose the password you will use to access your Re-New space." : "Enter your new password below.")}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    {u(portalSetup ? "Password" : "New password")}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={u("Min 8 characters")}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    {u("Confirm password")}
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={u("Repeat your password")}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{u(error)}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={loading}
                >
                  {u(loading ? (portalSetup ? "Saving..." : "Resetting...") : (portalSetup ? "Save password" : "Reset password"))}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
