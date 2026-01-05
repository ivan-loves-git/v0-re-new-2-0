"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

// Team members data - 3 Founders + 1 Team Member
const teamMembers = [
  {
    name: "Bertrand",
    role: "Founder",
    email: "bertrand.galas@edu.escp.eu",
    avatar: "/team/bertrand.png",
  },
  {
    name: "Amelie",
    role: "Founder",
    email: "amelie.lyon@edu.escp.eu",
    avatar: "/team/amelie.png",
  },
  {
    name: "Antoine",
    role: "Founder",
    email: "antoine.duchene@edu.escp.eu",
    avatar: "/team/antoine.png",
  },
  {
    name: "Team 2.0",
    role: "Team Member",
    email: "renew_2_0@iswearIdoingmybest.com",
    avatar: "/team/team-2-0.png",
  },
]

// Animated logo component (matching sidebar behavior)
function AnimatedLogo({ className = "" }: { className?: string }) {
  const [isHovering, setIsHovering] = useState(false)
  const [emojiIndex, setEmojiIndex] = useState(0)
  const LOGO_EMOJIS = ["🌊", "✨", "🌹", "🌵", "🌙"]

  useEffect(() => {
    if (!isHovering) {
      setEmojiIndex(0)
      return
    }
    const interval = setInterval(() => {
      setEmojiIndex((prev) => (prev + 1) % LOGO_EMOJIS.length)
    }, 150)
    return () => clearInterval(interval)
  }, [isHovering])

  return (
    <div
      className={`flex items-center gap-3 cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <span className={`text-3xl w-9 text-center ${isHovering ? "animate-wiggle" : ""}`}>
        {isHovering ? LOGO_EMOJIS[emojiIndex] : "🌊"}
      </span>
      <Image
        src="/wave-logo.png"
        alt="Wave"
        width={120}
        height={40}
        className={`invert ${isHovering ? "animate-wiggle" : ""}`}
      />
    </div>
  )
}

// Shared login form component
function LoginForm({
  onSelectUser,
  selectedEmail,
  layout = "grid", // "grid" | "horizontal" | "vertical" | "compact"
}: {
  onSelectUser: (email: string) => void
  selectedEmail: string
  layout?: "grid" | "horizontal" | "vertical" | "compact"
}) {
  const [email, setEmail] = useState(selectedEmail)
  const [password, setPassword] = useState("")

  // Update email when selectedEmail changes
  useEffect(() => {
    setEmail(selectedEmail)
    if (selectedEmail) {
      setPassword("Wave2025!")
    }
  }, [selectedEmail])

  const handleUserClick = (userEmail: string) => {
    setEmail(userEmail)
    setPassword("Wave2025!")
    onSelectUser(userEmail)
  }

  const renderUserButtons = () => {
    if (layout === "horizontal") {
      return (
        <div className="flex justify-center gap-4">
          {teamMembers.map((member) => (
            <button
              key={member.email}
              onClick={() => handleUserClick(member.email)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105 ${
                selectedEmail === member.email
                  ? "bg-blue-500/20 ring-2 ring-blue-500"
                  : "hover:bg-gray-800/50"
              }`}
            >
              <Image
                src={member.avatar}
                alt={member.name}
                width={56}
                height={56}
                className="rounded-full bg-white"
              />
              <div className="text-center">
                <p className="font-medium text-white text-sm">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
            </button>
          ))}
        </div>
      )
    }

    if (layout === "vertical") {
      return (
        <div className="space-y-2">
          {teamMembers.map((member) => (
            <button
              key={member.email}
              onClick={() => handleUserClick(member.email)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                selectedEmail === member.email
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-800 hover:border-gray-700 bg-gray-900/50"
              }`}
            >
              <Image
                src={member.avatar}
                alt={member.name}
                width={48}
                height={48}
                className="rounded-full bg-white"
              />
              <div className="text-left flex-1">
                <p className="font-medium text-white">{member.name}</p>
                <p className="text-sm text-gray-500">{member.role}</p>
              </div>
              {selectedEmail === member.email && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      )
    }

    if (layout === "compact") {
      return (
        <div className="flex flex-wrap justify-center gap-2">
          {teamMembers.map((member) => (
            <button
              key={member.email}
              onClick={() => handleUserClick(member.email)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                selectedEmail === member.email
                  ? "bg-blue-500 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Image
                src={member.avatar}
                alt={member.name}
                width={28}
                height={28}
                className="rounded-full bg-white"
              />
              <span className="text-sm font-medium">{member.name}</span>
            </button>
          ))}
        </div>
      )
    }

    // Default grid layout
    return (
      <div className="grid grid-cols-2 gap-3">
        {teamMembers.map((member) => (
          <button
            key={member.email}
            onClick={() => handleUserClick(member.email)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${
              selectedEmail === member.email
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-800 hover:border-gray-700 bg-gray-900/50"
            }`}
          >
            <Image
              src={member.avatar}
              alt={member.name}
              width={44}
              height={44}
              className="rounded-full bg-white"
            />
            <div className="text-left min-w-0">
              <p className="font-medium text-white truncate">{member.name}</p>
              <p className="text-xs text-gray-500 truncate">{member.role}</p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick login buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-400 text-center">
          Quick access
        </p>
        {renderUserButtons()}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="px-2 bg-gray-900 text-gray-500">
            or enter credentials
          </span>
        </div>
      </div>

      {/* Email/Password form */}
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-300">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
        <Button type="button" className="w-full" size="lg">
          Sign In
        </Button>
      </form>
    </div>
  )
}

// Design Dark v1: Classic split with grid pattern
function DesignDarkV1() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      {/* Left: Dark branding */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <AnimatedLogo />
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-4">
            Welcome back to Wave
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right: Dark login form */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex items-center bg-gray-900">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
          <p className="text-gray-400 mb-8">Select your profile to continue</p>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} layout="grid" />
        </div>
      </div>
    </div>
  )
}

// Design Dark v2: Horizontal avatars with wave accent
function DesignDarkV2() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      {/* Left: Dark branding with wave */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0 opacity-10">
          <svg viewBox="0 0 1440 320" className="w-full">
            <path fill="#3b82f6" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L0,320Z"/>
          </svg>
        </div>

        {/* Gradient orb */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-gradient-to-br from-blue-500/30 to-purple-500/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <AnimatedLogo />
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-4">
            Welcome back to Wave
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right: Login with horizontal avatars */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex items-center bg-gray-900">
        <div className="w-full max-w-lg mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-2 text-center">Sign in</h2>
          <p className="text-gray-400 mb-8 text-center">Select your profile to continue</p>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} layout="horizontal" />
        </div>
      </div>
    </div>
  )
}

// Design Dark v3: Vertical list with minimal left
function DesignDarkV3() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      {/* Left: Minimal dark branding */}
      <div className="lg:w-2/5 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden bg-gray-900">
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20" />

        <div className="relative z-10">
          <AnimatedLogo />
        </div>

        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-semibold text-white mb-3">
            Welcome back to Wave
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right: Login with vertical list */}
      <div className="lg:w-3/5 p-8 lg:p-12 flex items-center bg-gray-950">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
          <p className="text-gray-400 mb-6">Select your profile to continue</p>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} layout="vertical" />
        </div>
      </div>
    </div>
  )
}

// Design Dark v4: Compact pills with centered layout
function DesignDarkV4() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      {/* Left: Dark with dots pattern */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Dots pattern */}
        <div className="absolute inset-0 opacity-[0.15]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} />
        </div>

        {/* Multiple glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl" />

        <div className="relative z-10">
          <AnimatedLogo />
        </div>

        <div className="relative z-10 text-center lg:text-left">
          <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-4">
            Welcome back to Wave
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right: Compact login */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex items-center bg-gray-900/80 backdrop-blur">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
            <p className="text-gray-400">Select your profile to continue</p>
          </div>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} layout="compact" />
        </div>
      </div>
    </div>
  )
}

// Main preview page
export default function LoginPreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Login Page Designs</h1>
        <p className="text-gray-500 mt-1">
          4 dark variants based on your feedback. Hover over the logo to see the animation!
        </p>
      </div>

      <Tabs defaultValue="dark-v1" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="dark-v1">Grid Layout</TabsTrigger>
          <TabsTrigger value="dark-v2">Horizontal</TabsTrigger>
          <TabsTrigger value="dark-v3">Vertical List</TabsTrigger>
          <TabsTrigger value="dark-v4">Compact Pills</TabsTrigger>
        </TabsList>

        <TabsContent value="dark-v1">
          <DesignDarkV1 />
        </TabsContent>

        <TabsContent value="dark-v2">
          <DesignDarkV2 />
        </TabsContent>

        <TabsContent value="dark-v3">
          <DesignDarkV3 />
        </TabsContent>

        <TabsContent value="dark-v4">
          <DesignDarkV4 />
        </TabsContent>
      </Tabs>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-amber-800 text-sm">
            <strong>Team roles:</strong> Bertrand, Amelie, Antoine = Founders | Team 2.0 = Team Member
            <br />
            <strong>Note:</strong> Clicking a profile pre-fills credentials. Hover over the Wave logo to see the animation!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
