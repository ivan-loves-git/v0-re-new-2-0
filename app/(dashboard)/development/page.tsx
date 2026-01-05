"use client"

import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Platform colors for confetti
const CONFETTI_COLORS = [
  "#3b82f6", // primary blue
  "#2563eb", // chart-2
  "#1d4ed8", // chart-3
  "#ef4444", // destructive red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
]

// Fun emojis for confetti
const CONFETTI_EMOJIS = ["🌊", "✨", "🎉", "💫", "⭐", "🌟", "💙", "🔥", "🚀", "💎", "🎊", "🌈"]

const teamMembers = [
  { name: "Bertrand", role: "Founder", email: "bertrand.galas@edu.escp.eu", avatar: "/team/bertrand.png" },
  { name: "Amelie", role: "Founder", email: "amelie.lyon@edu.escp.eu", avatar: "/team/amelie.png" },
  { name: "Antoine", role: "Founder", email: "antoine.duchene@edu.escp.eu", avatar: "/team/antoine.png" },
  { name: "Team 2.0", role: "Guest Access", email: "renew_2_0@iswearIdoingmybest.com", avatar: "/team/team-2-0.png" },
]

interface Particle {
  id: number
  x: number
  y: number
  type: "dot" | "emoji"
  content: string
  color?: string
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  scale: number
  opacity: number
  delay: number
}

// Variant 1: Classic Burst - particles explode outward uniformly
function ConfettiBurst({ originX, originY, onComplete }: { originX: number; originY: number; onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const p: Particle[] = []
    // 10 dots
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3
      const velocity = 4 + Math.random() * 3
      p.push({
        id: i,
        x: 0,
        y: 0,
        type: "dot",
        content: "",
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 20 - 10,
        scale: 0.8 + Math.random() * 0.4,
        opacity: 1,
        delay: 0,
      })
    }
    // 10 emojis
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3 + 0.15
      const velocity = 3 + Math.random() * 2.5
      p.push({
        id: i + 10,
        x: 0,
        y: 0,
        type: "emoji",
        content: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        scale: 0.6 + Math.random() * 0.4,
        opacity: 1,
        delay: 0,
      })
    }
    setParticles(p)
  }, [])

  useEffect(() => {
    if (particles.length === 0) return
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15, // gravity
          rotation: p.rotation + p.rotationSpeed,
          opacity: Math.max(0, p.opacity - 0.025),
        }))
      )
    }, 16)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      onComplete()
    }, 1000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [particles.length, onComplete])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: originX + p.x,
            top: originY + p.y,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            opacity: p.opacity,
            transition: "none",
          }}
        >
          {p.type === "dot" ? (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
          ) : (
            <span className="text-lg">{p.content}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Variant 2: Fountain - particles shoot up then fall with gravity
function ConfettiFountain({ originX, originY, onComplete }: { originX: number; originY: number; onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const p: Particle[] = []
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8
      const velocity = 8 + Math.random() * 4
      p.push({
        id: i,
        x: (Math.random() - 0.5) * 20,
        y: 0,
        type: "dot",
        content: "",
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 15 - 7.5,
        scale: 0.8 + Math.random() * 0.4,
        opacity: 1,
        delay: i * 20,
      })
    }
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
      const velocity = 7 + Math.random() * 3
      p.push({
        id: i + 10,
        x: (Math.random() - 0.5) * 20,
        y: 0,
        type: "emoji",
        content: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 8 - 4,
        scale: 0.6 + Math.random() * 0.4,
        opacity: 1,
        delay: i * 25,
      })
    }
    setParticles(p)
  }, [])

  useEffect(() => {
    if (particles.length === 0) return
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed += 16
      setParticles((prev) =>
        prev.map((p) => {
          if (elapsed < p.delay) return p
          return {
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.25, // stronger gravity
            rotation: p.rotation + p.rotationSpeed,
            opacity: Math.max(0, p.opacity - 0.018),
          }
        })
      )
    }, 16)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      onComplete()
    }, 1200)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [particles.length, onComplete])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: originX + p.x,
            top: originY + p.y,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          {p.type === "dot" ? (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
          ) : (
            <span className="text-lg">{p.content}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Variant 3: Sparkle Pop - particles appear randomly around origin and float up
function ConfettiSparkle({ originX, originY, onComplete }: { originX: number; originY: number; onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const p: Particle[] = []
    for (let i = 0; i < 10; i++) {
      p.push({
        id: i,
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 60,
        type: "dot",
        content: "",
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vx: (Math.random() - 0.5) * 1,
        vy: -1 - Math.random() * 2,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10,
        scale: 0,
        opacity: 0,
        delay: i * 40,
      })
    }
    for (let i = 0; i < 10; i++) {
      p.push({
        id: i + 10,
        x: (Math.random() - 0.5) * 120,
        y: (Math.random() - 0.5) * 80,
        type: "emoji",
        content: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.8 - Math.random() * 1.5,
        rotation: 0,
        rotationSpeed: 0,
        scale: 0,
        opacity: 0,
        delay: i * 45 + 20,
      })
    }
    setParticles(p)
  }, [])

  useEffect(() => {
    if (particles.length === 0) return
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed += 16
      setParticles((prev) =>
        prev.map((p) => {
          if (elapsed < p.delay) return p
          const age = elapsed - p.delay
          const scaleIn = Math.min(1, age / 100) * (0.6 + Math.random() * 0.4)
          const fadeOut = age > 400 ? Math.max(0, 1 - (age - 400) / 400) : 1
          return {
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            rotation: p.rotation + p.rotationSpeed,
            scale: scaleIn,
            opacity: fadeOut,
          }
        })
      )
    }, 16)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      onComplete()
    }, 900)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [particles.length, onComplete])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: originX + p.x,
            top: originY + p.y,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          {p.type === "dot" ? (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          ) : (
            <span className="text-base">{p.content}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Variant 4: Ring Expansion - particles form expanding ring
function ConfettiRing({ originX, originY, onComplete }: { originX: number; originY: number; onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const p: Particle[] = []
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      p.push({
        id: i,
        x: 0,
        y: 0,
        type: "dot",
        content: "",
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        vx: Math.cos(angle) * 2.5,
        vy: Math.sin(angle) * 2.5,
        rotation: (angle * 180) / Math.PI,
        rotationSpeed: 5,
        scale: 0.3,
        opacity: 1,
        delay: i * 15,
      })
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.PI / 10
      p.push({
        id: i + 10,
        x: 0,
        y: 0,
        type: "emoji",
        content: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        rotation: 0,
        rotationSpeed: 0,
        scale: 0.3,
        opacity: 1,
        delay: i * 18 + 10,
      })
    }
    setParticles(p)
  }, [])

  useEffect(() => {
    if (particles.length === 0) return
    let elapsed = 0
    const interval = setInterval(() => {
      elapsed += 16
      setParticles((prev) =>
        prev.map((p) => {
          if (elapsed < p.delay) return p
          const age = elapsed - p.delay
          const scaleUp = Math.min(1, 0.3 + age / 300)
          const fadeOut = age > 500 ? Math.max(0, 1 - (age - 500) / 400) : 1
          return {
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            rotation: p.rotation + p.rotationSpeed,
            scale: scaleUp,
            opacity: fadeOut,
          }
        })
      )
    }, 16)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      onComplete()
    }, 1000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [particles.length, onComplete])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: originX + p.x,
            top: originY + p.y,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          {p.type === "dot" ? (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
          ) : (
            <span className="text-lg">{p.content}</span>
          )}
        </div>
      ))}
    </div>
  )
}

type ConfettiVariant = "burst" | "fountain" | "sparkle" | "ring"

function LoginWithConfetti({ variant }: { variant: ConfettiVariant }) {
  const [selectedEmail, setSelectedEmail] = useState("")
  const [confettiKey, setConfettiKey] = useState(0)
  const [confetti, setConfetti] = useState<{ x: number; y: number } | null>(null)

  const handleClick = useCallback((e: React.MouseEvent, email: string) => {
    const rect = (e.target as HTMLElement).closest("button")?.getBoundingClientRect()
    if (rect) {
      // Always trigger new confetti by incrementing key
      setConfettiKey((prev) => prev + 1)
      setConfetti({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }
    setSelectedEmail(email)
  }, [])

  const ConfettiComponent = {
    burst: ConfettiBurst,
    fountain: ConfettiFountain,
    sparkle: ConfettiSparkle,
    ring: ConfettiRing,
  }[variant]

  return (
    <div className="min-h-[500px] flex rounded-xl overflow-hidden border bg-white">
      {/* Left: Dark side (simplified) */}
      <div className="w-1/2 bg-gray-950 p-8 flex items-center justify-center relative overflow-hidden">
        {/* Dots pattern */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-cyan-500/20 rounded-full blur-2xl" />
        <p className="text-gray-400 text-center relative z-10">Click a profile to see confetti!</p>
      </div>

      {/* Right: Login form */}
      <div className="w-1/2 p-8 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h2>
          <p className="text-gray-500 mb-6">Choose your account to continue</p>

          <p className="text-sm font-medium text-gray-700 mb-3">Quick access</p>
          <div className="grid grid-cols-4 gap-2">
            {teamMembers.map((member) => (
              <button
                key={member.email}
                type="button"
                onClick={(e) => handleClick(e, member.email)}
                className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all hover:scale-105 ${
                  selectedEmail === member.email
                    ? "bg-blue-50 ring-2 ring-blue-500"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <Image
                  src={member.avatar}
                  alt={member.name}
                  width={44}
                  height={44}
                  className="rounded-full object-cover"
                />
                <div className="text-center">
                  <p className="font-medium text-gray-900 text-xs truncate w-full">{member.name}</p>
                  <p className="text-[10px] text-gray-500 truncate w-full">{member.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {confetti && (
        <ConfettiComponent
          key={confettiKey}
          originX={confetti.x}
          originY={confetti.y}
          onComplete={() => setConfetti(null)}
        />
      )}
    </div>
  )
}

export default function DevelopmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Development</h1>
        <p className="text-gray-500 mt-1">
          Testing area for new features and iterations
        </p>
      </div>

      <div className="space-y-8">
        {/* Login Confetti Animations */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Login Confetti Animations</h2>
          <p className="text-gray-500 mb-4">
            4 confetti variations with 10 colored dots + 10 emojis. Click any profile to test!
          </p>

          <Tabs defaultValue="fountain" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="burst">Burst</TabsTrigger>
              <TabsTrigger value="fountain">Fountain</TabsTrigger>
              <TabsTrigger value="sparkle">Sparkle</TabsTrigger>
              <TabsTrigger value="ring">Ring</TabsTrigger>
            </TabsList>

            <TabsContent value="burst">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Classic explosion - particles burst outward in all directions</p>
                <LoginWithConfetti variant="burst" />
              </div>
            </TabsContent>

            <TabsContent value="fountain">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Fountain effect - particles shoot up then fall with gravity</p>
                <LoginWithConfetti variant="fountain" />
              </div>
            </TabsContent>

            <TabsContent value="sparkle">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Sparkle pop - particles appear randomly and float up</p>
                <LoginWithConfetti variant="sparkle" />
              </div>
            </TabsContent>

            <TabsContent value="ring">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Ring expansion - particles form an expanding ring</p>
                <LoginWithConfetti variant="ring" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
