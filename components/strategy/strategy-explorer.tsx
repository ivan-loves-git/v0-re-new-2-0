"use client"

import { useState, useCallback, useRef } from "react"
import { PERSONAS } from "@/lib/data/strategy-data"
import { PersonaSelector } from "./persona-selector"
import { ReadinessRadar } from "./readiness-radar"
import { JourneyMap } from "./journey-map"
import { SellerView } from "./seller-view"
import { RevenueJourney } from "./revenue-journey"

export function StrategyExplorer() {
  const [selectedPersona, setSelectedPersona] = useState(0)
  const [scores, setScores] = useState<number[]>([...PERSONAS[0].scores])
  const [sellerView, setSellerView] = useState(false)
  const animRef = useRef<number | null>(null)

  const persona = PERSONAS[selectedPersona]

  const handlePersonaChange = useCallback((index: number) => {
    setSelectedPersona(index)
    setSellerView(false)

    const targetScores = [...PERSONAS[index].scores]

    // Cancel any running animation
    if (animRef.current) cancelAnimationFrame(animRef.current)

    // Animate scores transition
    setScores((prev) => {
      const start = [...prev]
      const startTime = performance.now()
      const duration = 400

      function step(now: number) {
        const t = Math.min((now - startTime) / duration, 1)
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        const interpolated = start.map((s, i) => s + (targetScores[i] - s) * ease)
        setScores(interpolated)
        if (t < 1) {
          animRef.current = requestAnimationFrame(step)
        }
      }
      animRef.current = requestAnimationFrame(step)
      return start
    })
  }, [])

  const handleScoreChange = useCallback((index: number, value: number) => {
    setScores((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-emerald-600">Re-New</span> Strategy Explorer
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Interactive Platform Vision V2.0</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>February 2026</p>
            <p className="text-emerald-600">For: Bertrand, Marie, Thomas</p>
          </div>
        </div>

        {/* Persona Selector */}
        <PersonaSelector
          personas={PERSONAS}
          selectedIndex={selectedPersona}
          onSelect={handlePersonaChange}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Radar */}
          <div className="lg:col-span-3">
            <ReadinessRadar
              scores={scores}
              onScoreChange={handleScoreChange}
            />
          </div>

          {/* Journey Map */}
          <div className="lg:col-span-6">
            <JourneyMap
              currentPhase={persona.phase}
              personaName={persona.name}
            />
          </div>

          {/* Seller View */}
          <div className="lg:col-span-3">
            <SellerView
              persona={persona}
              scores={scores}
              enabled={sellerView}
              onToggle={setSellerView}
            />
          </div>
        </div>

        {/* Revenue Journey */}
        <RevenueJourney persona={persona} />
      </div>
    </main>
  )
}
