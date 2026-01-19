"use client"

import { useState, useId } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

interface FloatingInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "email" | "tel" | "url"
  error?: string
  required?: boolean
  icon?: React.ReactNode
  className?: string
  placeholder?: string
}

/**
 * Floating label input with animated label that moves up on focus
 */
export function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  error,
  required,
  icon,
  className,
  placeholder,
}: FloatingInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const id = useId()

  const hasValue = value && value.length > 0
  const isFloating = isFocused || hasValue

  return (
    <div className={cn("relative", className)}>
      {/* Icon */}
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
          {icon}
        </div>
      )}

      {/* Input container */}
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFloating ? placeholder : undefined}
          className={cn(
            "w-full h-14 px-4 pt-5 pb-2 text-base rounded-xl border-2 transition-all duration-200",
            "bg-white/80 backdrop-blur-sm",
            "focus:outline-none focus:ring-0",
            icon && "pl-12",
            isFocused && !error && "border-blue-400 bg-white shadow-lg shadow-blue-100/50",
            !isFocused && !error && "border-gray-200 hover:border-gray-300",
            error && "border-red-400 bg-red-50/50"
          )}
        />

        {/* Floating label */}
        <motion.label
          htmlFor={id}
          className={cn(
            "absolute pointer-events-none transition-colors duration-200",
            icon ? "left-12" : "left-4",
            isFloating
              ? "text-xs font-medium"
              : "text-base",
            isFocused && !error && "text-blue-600",
            !isFocused && !error && "text-gray-500",
            error && "text-red-500"
          )}
          initial={false}
          animate={{
            top: isFloating ? "0.5rem" : "50%",
            translateY: isFloating ? "0%" : "-50%",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </motion.label>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 mt-1.5 text-sm text-red-500"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Floating label textarea with animated label
 */
interface FloatingTextareaProps {
  label: string
  value: string | null
  onChange: (value: string) => void
  error?: string
  required?: boolean
  rows?: number
  placeholder?: string
  className?: string
}

export function FloatingTextarea({
  label,
  value,
  onChange,
  error,
  required,
  rows = 4,
  placeholder,
  className,
}: FloatingTextareaProps) {
  const [isFocused, setIsFocused] = useState(false)
  const id = useId()

  const hasValue = value && value.length > 0
  const isFloating = isFocused || hasValue

  return (
    <div className={cn("relative", className)}>
      {/* Textarea container */}
      <div className="relative">
        <textarea
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFloating ? placeholder : undefined}
          rows={rows}
          className={cn(
            "w-full px-4 pt-7 pb-3 text-base rounded-xl border-2 transition-all duration-200 resize-none",
            "bg-white/80 backdrop-blur-sm",
            "focus:outline-none focus:ring-0",
            isFocused && !error && "border-blue-400 bg-white shadow-lg shadow-blue-100/50",
            !isFocused && !error && "border-gray-200 hover:border-gray-300",
            error && "border-red-400 bg-red-50/50"
          )}
        />

        {/* Floating label */}
        <motion.label
          htmlFor={id}
          className={cn(
            "absolute left-4 pointer-events-none transition-colors duration-200",
            isFloating
              ? "text-xs font-medium"
              : "text-base",
            isFocused && !error && "text-blue-600",
            !isFocused && !error && "text-gray-500",
            error && "text-red-500"
          )}
          initial={false}
          animate={{
            top: isFloating ? "0.5rem" : "1rem",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </motion.label>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 mt-1.5 text-sm text-red-500"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
