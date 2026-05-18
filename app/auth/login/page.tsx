"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { signIn } from "@/lib/auth-client"
import { submitWaitlistRequest } from "@/lib/actions/waitlist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

const LOGO_EMOJIS = ["🌊", "✨", "🌹", "🌵", "🌙"]

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "request">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"repreneur" | "seller" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestSubmitted, setRequestSubmitted] = useState(false)

  // Logo animation state
  const [isTouchActive, setIsTouchActive] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [emojiIndex, setEmojiIndex] = useState(0)
  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [supportsHover, setSupportsHover] = useState(false)

  const isAnimating = isTouchActive || isHovering

  // Detect hover capability on mount
  useEffect(() => {
    setSupportsHover(window.matchMedia("(hover: hover)").matches)
  }, [])

  // Cycle through emojis when animating
  useEffect(() => {
    if (!isAnimating) {
      setEmojiIndex(0)
      return
    }
    const interval = setInterval(() => {
      setEmojiIndex((prev) => (prev + 1) % LOGO_EMOJIS.length)
    }, 150)
    return () => clearInterval(interval)
  }, [isAnimating])

  // Cleanup touch timeout
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    }
  }, [])

  // Handle touch - wiggle for 3 seconds then stop
  const handleTouchStart = () => {
    if (supportsHover) return
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current)
    setIsTouchActive(true)
    touchTimeoutRef.current = setTimeout(() => {
      setIsTouchActive(false)
    }, 3000)
  }

  // Handle mouse hover - ONLY on devices that support hover (desktop)
  const handleMouseEnter = () => {
    if (!supportsHover) return
    setIsHovering(true)
  }
  const handleMouseLeave = () => {
    if (!supportsHover) return
    setIsHovering(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Invalid email or password")
        setLoading(false)
        return
      }

      if (result.data) {
        window.location.href = "/routing"
      } else {
        setError("Login succeeded but no session was created. Please try again.")
        setLoading(false)
      }
    } catch (err: any) {
      console.error("[Login] Exception:", err)
      setError(err?.message || "An unexpected error occurred")
      setLoading(false)
    }
  }

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Please enter your name.")
      return
    }
    if (!email.trim()) {
      setError("Please enter your email.")
      return
    }
    if (!role) {
      setError("Please select your role.")
      return
    }

    setLoading(true)

    try {
      const result = await submitWaitlistRequest(name.trim(), email.trim(), role)

      if (result.success) {
        setRequestSubmitted(true)
      } else {
        setError(result.error)
      }
    } catch (err: any) {
      console.error("[RequestAccess] Exception:", err)
      setError("Something went wrong. Please try again.")
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Dark header - MOBILE: slim centered logo only, DESKTOP: full side panel */}
      <div className="relative w-full lg:w-1/2 bg-gray-950 flex flex-col justify-center lg:justify-between py-6 lg:p-12 lg:min-h-screen overflow-hidden">
        {/* Blue dots pattern */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 size-48 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-32 bg-cyan-500/20 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center lg:flex-1">
          {/* Logo - centered on mobile, left-aligned on desktop */}
          <div
            className="logo-button flex items-center justify-center lg:justify-start gap-4 lg:mb-8 cursor-pointer lg:px-0"
            onTouchStart={handleTouchStart}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className={`text-5xl w-14 text-center ${isAnimating ? "animate-wiggle" : ""}`}>
              {isAnimating ? LOGO_EMOJIS[emojiIndex] : "🌊"}
            </span>
            <Image
              src="/wave-logo.png"
              alt="Wave - the repreneur CRM"
              width={216}
              height={72}
              className={`h-auto logo-image ${isTouchActive ? "animate-wiggle" : ""}`}
              style={{ filter: "brightness(0) invert(1)", width: "auto" }}
              priority
            />
          </div>

          {/* Description - desktop only */}
          <p className="text-muted-foreground text-lg leading-relaxed max-w-md hidden lg:block">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>

        {/* Status indicator - desktop only */}
        <div className="relative z-10 items-center gap-2 text-white/40 text-sm hidden lg:flex">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
          </span>
          All systems operational
        </div>
      </div>

      {/* Right side - Light */}
      <div className="w-full lg:w-1/2 bg-background flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {mode === "signin" ? (
            <>
              {/* Sign In Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Sign in</h1>
                <p className="text-muted-foreground">Enter your credentials to continue</p>
              </div>

              {/* Sign In Form */}
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-border focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground">
                      Password
                    </Label>
                    <a
                      href="/auth/forgot-password"
                      className="text-sm text-blue-500 hover:text-blue-600"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              {/* Toggle to Request Access */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Don&apos;t have access?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("request")}
                  className="text-blue-500 hover:text-blue-600 font-medium"
                >
                  Request it
                </button>
              </p>
            </>
          ) : requestSubmitted ? (
            /* Confirmation Screen */
            <div className="text-center py-4">
              <div className="size-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="size-8 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">You&apos;re on the list!</h1>
              <p className="text-muted-foreground leading-relaxed mb-8">
                We&apos;ve saved your request and will notify you by email as soon as the platform
                is officially open. Stay tuned!
              </p>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-blue-500 hover:text-blue-600 font-medium text-sm"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Request Access Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Request access</h1>
                <p className="text-muted-foreground">Tell us a bit about yourself and we&apos;ll be in touch</p>
              </div>

              {/* Request Access Form */}
              <form onSubmit={handleRequestAccess} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="req-name" className="text-foreground">
                    Name
                  </Label>
                  <Input
                    id="req-name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-border focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="req-email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="req-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-border focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Role Selector */}
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">I am a...</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("repreneur")}
                      disabled={loading}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        role === "repreneur"
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-border bg-background hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">🔑</span>
                      <span className={`text-sm font-medium ${role === "repreneur" ? "text-blue-700" : "text-foreground"}`}>
                        Repreneur
                      </span>
                      <span className={`text-xs ${role === "repreneur" ? "text-blue-500" : "text-muted-foreground"}`}>
                        Acquiring a business
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("seller")}
                      disabled={loading}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        role === "seller"
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-border bg-background hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">🏪</span>
                      <span className={`text-sm font-medium ${role === "seller" ? "text-blue-700" : "text-foreground"}`}>
                        Seller
                      </span>
                      <span className={`text-xs ${role === "seller" ? "text-blue-500" : "text-muted-foreground"}`}>
                        Selling a business
                      </span>
                    </button>
                  </div>
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
                  {loading ? "Submitting..." : "Request Access"}
                </Button>
              </form>

              {/* Toggle to Sign In */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-blue-500 hover:text-blue-600 font-medium"
                >
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* Status indicator - mobile only (at bottom of form) */}
          <div className="flex lg:hidden items-center justify-center gap-2 text-muted-foreground text-sm mt-8">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
            </span>
            All systems operational
          </div>
        </div>
      </div>
    </div>
  )
}
