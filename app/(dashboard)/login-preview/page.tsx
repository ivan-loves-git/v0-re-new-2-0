"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Team members data
const teamMembers = [
  {
    name: "Bertrand",
    role: "Founder",
    email: "bertrand.galas@edu.escp.eu",
    avatar: "/team/bertrand.png",
  },
  {
    name: "Amelie",
    role: "Team Member",
    email: "amelie.lyon@edu.escp.eu",
    avatar: "/team/amelie.png",
  },
  {
    name: "Antoine",
    role: "Team Member",
    email: "antoine.duchene@edu.escp.eu",
    avatar: "/team/antoine.png",
  },
  {
    name: "Team 2.0",
    role: "Guest Access",
    email: "renew_2_0@iswearIdoingmybest.com",
    avatar: "/team/team-2-0.png",
  },
]

// Shared login form component
function LoginForm({
  onSelectUser,
  selectedEmail,
  variant = "default"
}: {
  onSelectUser: (email: string) => void
  selectedEmail: string
  variant?: "default" | "dark" | "minimal"
}) {
  const [email, setEmail] = useState(selectedEmail)
  const [password, setPassword] = useState("")

  const handleUserClick = (userEmail: string) => {
    setEmail(userEmail)
    setPassword("Wave2025!")
    onSelectUser(userEmail)
  }

  const inputClass = variant === "dark"
    ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
    : ""

  return (
    <div className="space-y-6">
      {/* Quick login buttons */}
      <div className="space-y-3">
        <p className={`text-sm font-medium ${variant === "dark" ? "text-gray-300" : "text-gray-600"}`}>
          Quick access
        </p>
        <div className="grid grid-cols-2 gap-3">
          {teamMembers.map((member) => (
            <button
              key={member.email}
              onClick={() => handleUserClick(member.email)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                selectedEmail === member.email
                  ? "border-blue-500 bg-blue-50/10"
                  : variant === "dark"
                  ? "border-gray-700 hover:border-gray-600 bg-gray-800/50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
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
                <p className={`font-medium truncate ${variant === "dark" ? "text-white" : "text-gray-900"}`}>
                  {member.name}
                </p>
                <p className={`text-xs truncate ${variant === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  {member.role}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className={`w-full border-t ${variant === "dark" ? "border-gray-700" : "border-gray-200"}`} />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className={`px-2 ${variant === "dark" ? "bg-gray-900 text-gray-400" : "bg-white text-gray-500"}`}>
            or continue with email
          </span>
        </div>
      </div>

      {/* Email/Password form */}
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className={variant === "dark" ? "text-gray-300" : ""}>Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className={variant === "dark" ? "text-gray-300" : ""}>Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button type="button" className="w-full" size="lg">
          Sign In
        </Button>
      </form>
    </div>
  )
}

// Design 1: Dark Hero
function DesignDarkHero() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border">
      {/* Left: Dark branding panel */}
      <div className="lg:w-1/2 bg-gray-900 p-8 lg:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="text-3xl">🌊</span>
            <Image src="/wave-logo.png" alt="Wave" width={120} height={40} className="invert" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-4">
            Welcome back to Wave
          </h1>
          <p className="text-gray-400 text-lg">
            The repreneur CRM that helps you manage your pipeline and grow your acquisition practice.
          </p>
        </div>
        <div className="hidden lg:block">
          <p className="text-gray-500 text-sm">
            Re-New Platform v2.0
          </p>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="lg:w-1/2 bg-white p-8 lg:p-12 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Sign in</h2>
          <p className="text-gray-500 mb-8">Choose your account to continue</p>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} />
        </div>
      </div>
    </div>
  )
}

// Design 2: Blue Gradient
function DesignBlueGradient() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border">
      {/* Left: Blue gradient panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Decorative waves */}
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 320">
            <path fill="white" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"/>
          </svg>
          <svg className="absolute bottom-0 left-0 w-full translate-y-8" viewBox="0 0 1440 320">
            <path fill="white" d="M0,64L48,96C96,128,192,192,288,192C384,192,480,128,576,122.7C672,117,768,171,864,181.3C960,192,1056,160,1152,133.3C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"/>
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-3xl">🌊</span>
            <span className="text-2xl font-bold text-white">Wave</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ride the wave of opportunity
          </h1>
          <p className="text-blue-100 text-lg">
            Your repreneur journey starts here. Manage leads, track progress, and close deals.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-4 relative z-10">
          <div className="flex -space-x-2">
            {teamMembers.slice(0, 3).map((member) => (
              <Image
                key={member.email}
                src={member.avatar}
                alt={member.name}
                width={40}
                height={40}
                className="rounded-full border-2 border-blue-500 bg-white"
              />
            ))}
          </div>
          <p className="text-blue-100 text-sm">
            Join the Re-New team
          </p>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="lg:w-1/2 bg-white p-8 lg:p-12 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-8">Select your profile to sign in</p>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} />
        </div>
      </div>
    </div>
  )
}

// Design 3: Minimal Light
function DesignMinimalLight() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border bg-gray-50">
      {/* Left: Minimal branding */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center items-center bg-white border-r">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-5xl">🌊</span>
          </div>
          <Image src="/wave-logo.png" alt="Wave" width={160} height={53} className="mx-auto mb-6" />
          <p className="text-gray-500 text-lg max-w-xs">
            The repreneur CRM
          </p>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex items-center bg-gray-50">
        <div className="w-full max-w-md mx-auto">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Choose your account to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Design 4: Full Dark
function DesignFullDark() {
  const [selectedEmail, setSelectedEmail] = useState("")

  return (
    <div className="min-h-[700px] flex flex-col lg:flex-row rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      {/* Left: Dark branding with pattern */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-4xl">🌊</span>
            <span className="text-2xl font-bold text-white">Wave</span>
          </div>
        </div>

        <div className="relative z-10 text-center lg:text-left">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Re-New
            <span className="block text-blue-400">Platform</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Enterprise acquisition management for the modern repreneur.
          </p>
        </div>

        <div className="hidden lg:block relative z-10">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right: Dark login form */}
      <div className="lg:w-1/2 p-8 lg:p-12 flex items-center bg-gray-900">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
          <p className="text-gray-400 mb-8">Select your profile to continue</p>
          <LoginForm onSelectUser={setSelectedEmail} selectedEmail={selectedEmail} variant="dark" />
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
          Preview and compare 4 different design approaches. Click through to see how each looks.
        </p>
      </div>

      <Tabs defaultValue="dark-hero" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="dark-hero">Dark Hero</TabsTrigger>
          <TabsTrigger value="blue-gradient">Blue Gradient</TabsTrigger>
          <TabsTrigger value="minimal-light">Minimal Light</TabsTrigger>
          <TabsTrigger value="full-dark">Full Dark</TabsTrigger>
        </TabsList>

        <TabsContent value="dark-hero">
          <DesignDarkHero />
        </TabsContent>

        <TabsContent value="blue-gradient">
          <DesignBlueGradient />
        </TabsContent>

        <TabsContent value="minimal-light">
          <DesignMinimalLight />
        </TabsContent>

        <TabsContent value="full-dark">
          <DesignFullDark />
        </TabsContent>
      </Tabs>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-amber-800 text-sm">
            <strong>Note:</strong> These are interactive previews. The buttons will pre-fill credentials but won&apos;t actually log you in.
            Once you pick a design, I&apos;ll implement it as the real login page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
