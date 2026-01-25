"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, ExternalLink, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CompletionScreenProps {
  finalScore: number | null
}

// Confetti particle component
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      className="absolute w-3 h-3 rounded-full pointer-events-none"
      style={{
        backgroundColor: color,
        left: `${x}%`,
        top: -20,
      }}
      initial={{ y: -20, opacity: 1, rotate: 0, scale: 1 }}
      animate={{
        y: [0, 600],
        opacity: [1, 1, 0],
        rotate: [0, 360, 720],
        scale: [1, 0.8, 0.5],
        x: [0, Math.random() > 0.5 ? 50 : -50],
      }}
      transition={{
        duration: 3,
        delay,
        ease: "easeOut",
      }}
    />
  )
}

/**
 * Completion screen with confetti celebration
 */
export function CompletionScreen({ finalScore }: CompletionScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    // Hide confetti after 4 seconds
    const timer = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const confettiColors = [
    "#3B82F6", // blue
    "#8B5CF6", // purple
    "#10B981", // emerald
    "#F59E0B", // amber
    "#EC4899", // pink
    "#06B6D4", // cyan
  ]

  // Generate confetti particles
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 100,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
  }))

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-lg w-full text-center relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.prod.website-files.com/68a87ebceebd6aec9fa8d6b3/68b6fe358d32a837b0522d9a_Logo.svg"
            alt="Re-New"
            className="h-12 w-auto mx-auto"
          />
        </motion.div>

        {/* Success icon with glow */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="relative w-24 h-24 mx-auto mb-6"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full blur-xl opacity-50" />

          {/* Icon container */}
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-200">
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <Sparkles className="w-12 h-12 text-white" />
            </motion.div>
          </div>

          {/* Floating party icons */}
          <motion.div
            className="absolute -right-2 -top-2"
            initial={{ opacity: 0, scale: 0, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.7, type: "spring" }}
          >
            <PartyPopper className="w-8 h-8 text-amber-500" />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-gray-900 mb-4"
        >
          Welcome to Re-New!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-gray-600 mb-8"
        >
          Your profile has been created successfully. Our team will review your information and reach out to you soon.
        </motion.p>

        {/* Score card with glassmorphism */}
        {finalScore !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="relative mb-8"
          >
            {/* Glow behind */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-xl opacity-30" />

            {/* Card */}
            <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 backdrop-blur-sm">
              <p className="text-sm text-blue-600 font-medium mb-2">Your Readiness Score</p>
              <motion.p
                className="text-6xl font-bold text-blue-700"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
              >
                {finalScore}
              </motion.p>
              <p className="text-sm text-blue-500 mt-2">out of 100</p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            size="lg"
            className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
            onClick={() => window.open("https://renew.team", "_blank")}
          >
            Visit Re-New
            <ExternalLink className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
