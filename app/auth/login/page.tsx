"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import Image from "next/image"

const teamMembers = [
  { name: "Bertrand", role: "Founder", email: "bertrand.galas@edu.escp.eu", avatar: "/team/bertrand.png" },
  { name: "Amelie", role: "Founder", email: "amelie.lyon@edu.escp.eu", avatar: "/team/amelie.png" },
  { name: "Antoine", role: "Founder", email: "antoine.duchene@edu.escp.eu", avatar: "/team/antoine.png" },
  { name: "Team 2.0", role: "Guest Access", email: "renew_2_0@iswearIdoingmybest.com", avatar: "/team/team-2-0.png" },
]

const LOGO_EMOJIS = ["🌊", "✨", "🌹", "🌵", "🌙"]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  // Logo animation state (copied from sidebar)
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

  const handleMouseEnter = () => setIsHovering(true)
  const handleMouseLeave = () => setIsHovering(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (data.session) {
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 100)
      } else {
        setError("Login succeeded but no session was created. Please try again.")
        setLoading(false)
      }
    } catch (err) {
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  const selectUser = (member: (typeof teamMembers)[0]) => {
    setSelectedUser(member.email)
    setEmail(member.email)
    setPassword("Wave2025!")
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Dark with dots pattern and glow orbs (from v4) */}
      <div className="relative w-full lg:w-1/2 bg-gray-950 flex flex-col justify-between p-8 lg:p-12 min-h-[40vh] lg:min-h-screen overflow-hidden">
        {/* Blue dots pattern */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center flex-1">
          {/* Logo - exact copy from sidebar, scaled up ~50% */}
          <div
            className="logo-button flex items-center gap-4 mb-8 cursor-pointer"
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
              style={{ filter: "brightness(0) invert(1)" }}
              priority
            />
          </div>

          <p className="text-gray-400 text-lg leading-relaxed max-w-md">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>

        {/* Status indicator */}
        <div className="relative z-10 flex items-center gap-2 text-white/40 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          All systems operational
        </div>
      </div>

      {/* Right side - Light */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h1>
            <p className="text-gray-500">Choose your account to continue</p>
          </div>

          {/* Quick access - Horizontal layout from v2 (avatar on top, name/role below) */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-sm font-medium text-gray-700">Quick access</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-0.5 rounded-full hover:bg-gray-100 transition-colors">
                      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      Temporary feature to speed up testing. Credentials will be provided to all users and this section will be removed once live.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {teamMembers.map((member) => (
                <button
                  key={member.email}
                  type="button"
                  onClick={() => selectUser(member)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105 ${
                    selectedUser === member.email
                      ? "bg-blue-50 ring-2 ring-blue-500"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <Image
                    src={member.avatar}
                    alt={member.name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                  <div className="text-center">
                    <p className="font-medium text-gray-900 text-sm truncate w-full">{member.name}</p>
                    <p className="text-xs text-gray-500 truncate w-full">{member.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-gray-400 tracking-wider">or continue with email</span>
            </div>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
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
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
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
        </div>
      </div>
    </div>
  )
}
