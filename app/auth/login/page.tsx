"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { signIn } from "@/lib/auth-client"
import { submitWaitlistRequest } from "@/lib/actions/waitlist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { KeyRound, Store, Waves } from "lucide-react"
import { captureWaveEvent } from "@/lib/telemetry/runtime"
import { LanguageToggle } from "@/components/intake-v2/language-toggle"
import { useUiCopy } from "@/components/i18n/ui-text"
import { signInErrorCopy } from "@/lib/i18n/auth-outcomes"
import type { UiCopyKey } from "@/lib/i18n/ui-copy"

export default function LoginPage() {
  const u = useUiCopy()
  const [mode, setMode] = useState<"signin" | "request">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"repreneur" | "seller" | null>(null)
  const [error, setError] = useState<UiCopyKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    setAccessDenied(
      new URLSearchParams(window.location.search).get("reason") === "access_denied",
    )
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hydrated) return
    setError(null)
    setLoading(true)
    captureWaveEvent("wave_action_started", {
      surface: "auth",
      role: "anonymous",
      workflow: "authentication",
      action: "sign_in",
    })

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        captureWaveEvent("wave_auth_failed", {
          surface: "auth",
          role: "anonymous",
          workflow: "authentication",
          action: "sign_in",
          outcome: "rejected",
        })
        setError(signInErrorCopy(result.error))
        setLoading(false)
        return
      }

      if (result.data) {
        captureWaveEvent("wave_auth_succeeded", {
          surface: "auth",
          role: "anonymous",
          workflow: "authentication",
          action: "sign_in",
          outcome: "success",
        })
        window.location.href = "/routing"
      } else {
        captureWaveEvent("wave_auth_failed", {
          surface: "auth",
          role: "anonymous",
          workflow: "authentication",
          action: "sign_in",
          outcome: "missing_session",
        })
        setError("Login succeeded but no session was created. Please try again.")
        setLoading(false)
      }
    } catch {
      console.error("[Login] Sign-in failed")
      captureWaveEvent("wave_auth_failed", {
        surface: "auth",
        role: "anonymous",
        workflow: "authentication",
        action: "sign_in",
        outcome: "unexpected_error",
      })
      setError("Sign-in is temporarily unavailable. Please try again.")
      setLoading(false)
    }
  }

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      captureWaveEvent("wave_validation_failed", {
        surface: "auth",
        role: "anonymous",
        workflow: "access_request",
        action: "request_access",
        outcome: "validation_error",
      })
      setError("Please enter your name.")
      return
    }
    if (!email.trim()) {
      captureWaveEvent("wave_validation_failed", {
        surface: "auth",
        role: "anonymous",
        workflow: "access_request",
        action: "request_access",
        outcome: "validation_error",
      })
      setError("Please enter your email.")
      return
    }
    if (!role) {
      captureWaveEvent("wave_validation_failed", {
        surface: "auth",
        role: "anonymous",
        workflow: "access_request",
        action: "request_access",
        outcome: "validation_error",
      })
      setError("Please select your role.")
      return
    }

    setLoading(true)
    captureWaveEvent("wave_action_started", {
      surface: "auth",
      role: "anonymous",
      workflow: "access_request",
      action: "request_access",
    })

    try {
      const result = await submitWaitlistRequest(name.trim(), email.trim(), role)

      if (result.success) {
        captureWaveEvent("wave_action_succeeded", {
          surface: "auth",
          role: "anonymous",
          workflow: "access_request",
          action: "request_access",
          outcome: "success",
        })
        setRequestSubmitted(true)
      } else {
        captureWaveEvent("wave_action_failed", {
          surface: "auth",
          role: "anonymous",
          workflow: "access_request",
          action: "request_access",
          outcome: "failure",
        })
        setError("Access request is temporarily unavailable. Please try again.")
      }
    } catch {
      console.error("[RequestAccess] Submission failed")
      captureWaveEvent("wave_action_failed", {
        surface: "auth",
        role: "anonymous",
        workflow: "access_request",
        action: "request_access",
        outcome: "unexpected_error",
      })
      setError("Access request is temporarily unavailable. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: "signin" | "request") => {
    setMode(newMode)
    setError(null)
    setRequestSubmitted(false)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background lg:flex-row">
      <aside className="flex w-full flex-col justify-between border-b border-sidebar-border bg-sidebar px-6 py-5 text-sidebar-foreground lg:min-h-svh lg:w-[42%] lg:border-b-0 lg:border-r lg:px-12 lg:py-10 xl:px-16">
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 place-items-center rounded-lg border border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground">
            <Waves className="size-5" />
            <span aria-hidden="true" className="absolute -bottom-px left-1/2 h-0.5 w-4 -translate-x-1/2 bg-sidebar-primary-foreground" />
          </span>
          <span className="grid leading-tight">
            <span className="text-sm font-semibold tracking-[0.14em]">WAVE</span>
            <span className="text-[10px] text-sidebar-foreground/70">by Re-New</span>
          </span>
        </div>

        <div className="hidden max-w-lg py-16 lg:block">
          <p className="wave-micro-label text-sidebar-foreground/70">{u("Re-New operating system")}</p>
          <h2 className="mt-5 font-heading text-4xl font-medium leading-[1.12] tracking-[-0.035em] xl:text-5xl">
            {u("Steer the acquisition journey with clarity.")}
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-sidebar-foreground/70">
            {u("One trusted workspace for repreneurs, opportunities, decisions, and the work that moves them forward.")}
          </p>
        </div>

        <div className="hidden items-center gap-2 text-xs text-sidebar-foreground/70 lg:flex">
          <span className="size-1.5 rounded-full bg-success" />
          {u("Secure Re-New workspace")}
        </div>
      </aside>

      <main id="main-content" className="flex w-full flex-1 items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-4 flex flex-col items-end gap-1">
            <LanguageToggle />
          </div>
          {mode === "signin" ? (
            <>
              {/* Sign In Header */}
              <div className="mb-8">
                <p className="wave-eyebrow mb-2">{u("Workspace access")}</p>
                <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.03em] text-foreground">{u("Welcome back")}</h1>
                <p className="text-sm text-muted-foreground">{u("Sign in to continue to the Re-New workspace.")}</p>
              </div>

              {accessDenied && (
                <Alert className="mb-4">
                  <AlertDescription>
                    {u("This account is signed in but does not have access to a Re-New workspace. Request access or use an approved account.")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Sign In Form */}
              <form method="post" onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground">
                      {u("Password")}
                    </Label>
                    <a
                      href="/auth/forgot-password"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {u("Forgot password?")}
                    </a>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  disabled={!hydrated || loading}
                >
                  {loading ? u("Signing in...") : u("Sign In")}
                </Button>
                {!hydrated && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {u("Preparing secure sign-in. If this continues, enable JavaScript and reload.")}
                  </p>
                )}
              </form>

              {/* Toggle to Request Access */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                {u("Don't have access?")}{" "}
                <button
                  type="button"
                  onClick={() => switchMode("request")}
                  className="font-medium text-primary hover:underline"
                >
                  {u("Request it")}
                </button>
              </p>
            </>
          ) : requestSubmitted ? (
            /* Confirmation Screen */
            <div className="text-center py-4">
              <div className="size-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="size-8 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="mb-3 text-[28px] font-semibold tracking-[-0.03em] text-foreground">{u("You're on the list")}</h1>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {u("We've saved your request and will notify you by email as soon as the platform is officially open. Stay tuned!")}
              </p>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-sm font-medium text-primary hover:underline"
              >
                {u("Back to Sign In")}
              </button>
            </div>
          ) : (
            <>
              {/* Request Access Header */}
              <div className="mb-8">
                <p className="wave-eyebrow mb-2">{u("Join Re-New")}</p>
                <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.03em] text-foreground">{u("Request access")}</h1>
                <p className="text-sm text-muted-foreground">{u("Tell us about your role and we'll be in touch.")}</p>
              </div>

              {/* Request Access Form */}
              <form onSubmit={handleRequestAccess} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="req-name" className="text-foreground">
                    {u("Name")}
                  </Label>
                  <Input
                    id="req-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder={u("Your name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="req-email" className="text-foreground">
                    {u("Email")}
                  </Label>
                  <Input
                    id="req-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                {/* Role Selector */}
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">{u("I am a...")}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("repreneur")}
                      disabled={loading}
                      aria-pressed={role === "repreneur"}
                      className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                        role === "repreneur"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-input hover:bg-muted/40"
                      }`}
                    >
                      <KeyRound className={role === "repreneur" ? "size-5 text-primary" : "size-5 text-muted-foreground"} />
                      <span className={`text-sm font-semibold ${role === "repreneur" ? "text-primary" : "text-foreground"}`}>
                        {u("Repreneur")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {u("Acquiring a business")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("seller")}
                      disabled={loading}
                      aria-pressed={role === "seller"}
                      className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                        role === "seller"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-input hover:bg-muted/40"
                      }`}
                    >
                      <Store className={role === "seller" ? "size-5 text-primary" : "size-5 text-muted-foreground"} />
                      <span className={`text-sm font-semibold ${role === "seller" ? "text-primary" : "text-foreground"}`}>
                        {u("Seller")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {u("Selling a business")}
                      </span>
                    </button>
                  </div>
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
                  {loading ? u("Submitting...") : u("Request Access")}
                </Button>
              </form>

              {/* Toggle to Sign In */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                {u("Already have an account?")}{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-medium text-primary hover:underline"
                >
                  {u("Sign in")}
                </button>
              </p>
            </>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground lg:hidden">
            <span className="size-1.5 rounded-full bg-teal-600" />
            {u("Secure Re-New workspace")}
          </div>
        </div>
      </main>
    </div>
  )
}
