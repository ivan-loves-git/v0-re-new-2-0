"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepInfo {
  id: number
  title: string
  icon: React.ReactNode
}

interface GlassProgressProps {
  steps: StepInfo[]
  currentStep: number
  className?: string
}

/**
 * Glass morphism progress bar with animated step indicators
 */
export function GlassProgress({ steps, currentStep, className }: GlassProgressProps) {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100

  return (
    <div className={cn("relative", className)}>
      {/* Glass container */}
      <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl shadow-black/5">
        {/* Progress track */}
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-gray-200/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Step indicators */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <div key={step.id} className="flex flex-col items-center gap-2 z-10">
                {/* Step circle */}
                <motion.div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                    "backdrop-blur-sm border-2",
                    isActive && "bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-400 text-white shadow-lg shadow-blue-200/50",
                    isCompleted && "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-200/50",
                    !isActive && !isCompleted && "bg-white/80 border-gray-200 text-gray-400"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={false}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <span className="text-sm font-semibold">{step.icon}</span>
                  )}
                </motion.div>

                {/* Step label */}
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block transition-colors duration-300",
                    isActive && "text-blue-600",
                    isCompleted && "text-emerald-600",
                    !isActive && !isCompleted && "text-gray-400"
                  )}
                >
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Subtle glow effect behind the glass */}
      <div
        className="absolute inset-0 -z-10 blur-2xl opacity-30"
        style={{
          background: `linear-gradient(to right,
            ${currentStep >= 1 ? "rgb(59, 130, 246)" : "transparent"},
            ${currentStep >= 3 ? "rgb(99, 102, 241)" : "rgb(209, 213, 219)"},
            ${currentStep >= 5 ? "rgb(16, 185, 129)" : "rgb(209, 213, 219)"}
          )`,
        }}
      />
    </div>
  )
}
