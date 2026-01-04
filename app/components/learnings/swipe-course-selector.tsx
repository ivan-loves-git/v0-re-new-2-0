"use client"

import { useState, useRef, useEffect } from "react"
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"
import { Check, Lock, Trophy, Target } from "lucide-react"

// Course data structure
interface Lesson {
  id: string
  title: string
  status: "completed" | "current" | "locked"
}

interface Course {
  id: string
  title: string
  level: string
  color: "blue" | "yellow" | "purple" | "green"
  recommended?: boolean
  lessons: Lesson[]
}

const courses: Course[] = [
  {
    id: "finance",
    title: "Financial Planning",
    level: "Module 1",
    color: "blue",
    recommended: true,
    lessons: [
      { id: "capacity", title: "Assess Your Investment Capacity", status: "completed" },
      { id: "funding", title: "Explore Funding Options", status: "completed" },
      { id: "structure", title: "Deal Structure Basics", status: "current" },
      { id: "projections", title: "Financial Projections", status: "locked" },
    ],
  },
  {
    id: "duediligence",
    title: "Due Diligence",
    level: "Module 2",
    color: "yellow",
    lessons: [
      { id: "checklist", title: "Due Diligence Checklist", status: "completed" },
      { id: "financials", title: "Analyzing Financial Statements", status: "current" },
      { id: "legal", title: "Legal & Compliance Review", status: "locked" },
      { id: "operations", title: "Operational Assessment", status: "locked" },
    ],
  },
  {
    id: "negotiation",
    title: "Deal Negotiation",
    level: "Module 3",
    color: "purple",
    recommended: true,
    lessons: [
      { id: "valuation", title: "Company Valuation Methods", status: "current" },
      { id: "loi", title: "Letter of Intent (LOI)", status: "locked" },
      { id: "terms", title: "Negotiating Deal Terms", status: "locked" },
      { id: "closing", title: "Closing the Transaction", status: "locked" },
    ],
  },
  {
    id: "transition",
    title: "Post-Acquisition",
    level: "Module 4",
    color: "green",
    lessons: [
      { id: "day1", title: "First 100 Days Plan", status: "locked" },
      { id: "team", title: "Managing the Existing Team", status: "locked" },
      { id: "culture", title: "Culture Integration", status: "locked" },
      { id: "growth", title: "Growth Strategy Execution", status: "locked" },
    ],
  },
]

// Color configurations
const colorConfig = {
  blue: {
    primary: "#3B82F6",
    light: "#EFF6FF",
    dot: "#3B82F6",
    button: "bg-blue-500 hover:bg-blue-600",
    levelText: "text-blue-600",
    illustration: "from-blue-400 to-blue-600",
  },
  yellow: {
    primary: "#F59E0B",
    light: "#FFFBEB",
    dot: "#F59E0B",
    button: "bg-amber-400 hover:bg-amber-500",
    levelText: "text-amber-600",
    illustration: "from-amber-300 to-amber-500",
  },
  purple: {
    primary: "#8B5CF6",
    light: "#F5F3FF",
    dot: "#8B5CF6",
    button: "bg-purple-500 hover:bg-purple-600",
    levelText: "text-purple-600",
    illustration: "from-purple-400 to-purple-600",
  },
  green: {
    primary: "#10B981",
    light: "#ECFDF5",
    dot: "#10B981",
    button: "bg-emerald-500 hover:bg-emerald-600",
    levelText: "text-emerald-600",
    illustration: "from-emerald-400 to-emerald-600",
  },
}

// Placeholder illustrations for each course type
function CourseIllustration({ course }: { course: Course }) {
  const config = colorConfig[course.color]

  return (
    <div className={cn(
      "w-56 h-56 rounded-3xl flex items-center justify-center",
      "bg-gradient-to-br shadow-lg",
      config.illustration
    )}>
      {course.id === "finance" && (
        <div className="relative">
          {/* Financial chart with euro symbol */}
          <div className="w-36 h-28 relative">
            {/* Chart bars */}
            <div className="absolute bottom-0 left-0 w-6 h-12 bg-blue-200 rounded-t-lg" />
            <div className="absolute bottom-0 left-8 w-6 h-16 bg-blue-300 rounded-t-lg" />
            <div className="absolute bottom-0 left-16 w-6 h-20 bg-blue-200 rounded-t-lg" />
            <div className="absolute bottom-0 left-24 w-6 h-24 bg-white/80 rounded-t-lg" />
            {/* Euro symbol */}
            <div className="absolute -top-2 right-0 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600">&#8364;</span>
            </div>
          </div>
        </div>
      )}
      {course.id === "duediligence" && (
        <div className="relative">
          {/* Magnifying glass with document */}
          <div className="w-32 h-32 relative flex items-center justify-center">
            {/* Document */}
            <div className="absolute w-20 h-24 bg-white rounded-lg shadow-lg transform -rotate-6">
              <div className="p-2 space-y-1.5">
                <div className="w-full h-2 bg-amber-200 rounded" />
                <div className="w-3/4 h-2 bg-amber-100 rounded" />
                <div className="w-full h-2 bg-amber-200 rounded" />
                <div className="w-1/2 h-2 bg-amber-100 rounded" />
              </div>
            </div>
            {/* Magnifying glass */}
            <div className="absolute right-0 bottom-0 transform translate-x-2 translate-y-2">
              <div className="w-14 h-14 rounded-full border-4 border-amber-600 bg-amber-100/50" />
              <div className="w-3 h-8 bg-amber-600 rounded-full absolute -bottom-6 -right-1 transform rotate-45" />
            </div>
          </div>
        </div>
      )}
      {course.id === "negotiation" && (
        <div className="relative">
          {/* Handshake / Deal illustration */}
          <div className="w-32 h-28 relative flex items-center justify-center">
            {/* Two hands meeting */}
            <div className="absolute left-0 w-16 h-6 bg-purple-200 rounded-r-full transform -rotate-12" />
            <div className="absolute right-0 w-16 h-6 bg-purple-300 rounded-l-full transform rotate-12" />
            {/* Contract in center */}
            <div className="relative z-10 w-16 h-20 bg-white rounded-lg shadow-lg flex flex-col items-center justify-center">
              <div className="w-10 h-1.5 bg-purple-300 rounded mb-1" />
              <div className="w-8 h-1.5 bg-purple-200 rounded mb-1" />
              <div className="w-10 h-1.5 bg-purple-300 rounded mb-2" />
              <div className="text-purple-600 text-lg">&#10003;</div>
            </div>
          </div>
        </div>
      )}
      {course.id === "transition" && (
        <div className="relative">
          {/* Building with growth arrow */}
          <div className="w-32 h-32 relative flex items-center justify-center">
            {/* Building */}
            <div className="w-20 h-24 bg-emerald-200 rounded-t-lg relative">
              <div className="absolute inset-2 grid grid-cols-2 gap-1">
                <div className="bg-white/60 rounded-sm" />
                <div className="bg-white/60 rounded-sm" />
                <div className="bg-white/60 rounded-sm" />
                <div className="bg-white/60 rounded-sm" />
                <div className="bg-white/60 rounded-sm" />
                <div className="bg-white/60 rounded-sm" />
              </div>
            </div>
            {/* Growth arrow */}
            <div className="absolute -right-2 -top-2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
              <span className="text-emerald-600 text-2xl">&#8593;</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Lesson item component
function LessonItem({ lesson, color }: { lesson: Lesson; color: Course["color"] }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-3">
        {/* Icon circle */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          lesson.status === "completed" && "bg-gradient-to-br from-green-400 to-green-500",
          lesson.status === "current" && "bg-gradient-to-br from-gray-100 to-gray-200 ring-2 ring-green-500 ring-offset-2",
          lesson.status === "locked" && "bg-gray-100"
        )}>
          {lesson.status === "completed" && <Check className="w-5 h-5 text-white" />}
          {lesson.status === "current" && (
            <div className="w-3 h-3 rounded-full bg-green-500" />
          )}
          {lesson.status === "locked" && <Lock className="w-4 h-4 text-gray-400" />}
        </div>

        {/* Title */}
        <span className={cn(
          "font-medium",
          lesson.status === "locked" ? "text-gray-400" : "text-gray-900"
        )}>
          {lesson.title}
        </span>
      </div>

      {/* Status indicator */}
      <div className={cn(
        "w-5 h-5 rounded-full",
        lesson.status === "completed" && "bg-blue-500 flex items-center justify-center",
        lesson.status === "current" && "bg-gray-200",
        lesson.status === "locked" && "bg-gray-200"
      )}>
        {lesson.status === "completed" && <Check className="w-3 h-3 text-white" />}
      </div>
    </div>
  )
}

export function SwipeCourseSelector() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Motion values for drag-based navigation
  const x = useMotionValue(0)
  const dragProgress = useTransform(x, [-containerWidth, 0, containerWidth], [1, 0, -1])

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  // Spring configuration for "weighty but responsive" feel
  const springConfig = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
  }

  // Handle drag end with snap physics
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = containerWidth * 0.2 // 20% threshold for easier swiping
    const velocity = info.velocity.x
    const offset = info.offset.x

    let newIndex = currentIndex

    // Check if we should move to next/prev based on offset OR velocity
    if (offset < -threshold || velocity < -500) {
      newIndex = Math.min(currentIndex + 1, courses.length - 1)
    } else if (offset > threshold || velocity > 500) {
      newIndex = Math.max(currentIndex - 1, 0)
    }

    setCurrentIndex(newIndex)
    animate(x, 0, springConfig)
  }

  // Navigate to specific page
  const goToPage = (index: number) => {
    setCurrentIndex(index)
  }

  const currentCourse = courses[currentIndex]
  const config = colorConfig[currentCourse.color]

  return (
    <div className="w-full max-w-2xl mx-auto bg-gray-50 rounded-3xl overflow-hidden shadow-2xl">
      {/* Fixed Header - Progress counters */}
      <div className="sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-800">3 completed</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
          <Target className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">13 remaining</span>
        </div>
      </div>

      {/* Swipeable Content Area */}
      <div ref={containerRef} className="relative overflow-hidden">
        <motion.div
          className="cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          style={{ x }}
        >
          {/* Course Page Content */}
          <div className="px-8 py-6 flex flex-col items-center min-h-[520px]">
            {/* Recommended Badge */}
            {currentCourse.recommended && (
              <motion.div
                key={`badge-${currentIndex}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2"
              >
                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-600 bg-amber-50 rounded-full">
                  Recommended
                </span>
              </motion.div>
            )}

            {/* Course Title */}
            <motion.h2
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-bold text-gray-900 text-center"
            >
              {currentCourse.title}
            </motion.h2>

            {/* Level */}
            <motion.p
              key={`level-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={cn("text-sm font-semibold uppercase tracking-wide mt-1", config.levelText)}
            >
              {currentCourse.level}
            </motion.p>

            {/* Hero Illustration */}
            <motion.div
              key={`illustration-${currentIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="my-8"
            >
              <CourseIllustration course={currentCourse} />
            </motion.div>

            {/* Pagination Dots */}
            <div className="flex gap-2 mb-6">
              {courses.map((course, index) => (
                <motion.button
                  key={course.id}
                  onClick={() => goToPage(index)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-200",
                    index === currentIndex
                      ? "scale-110"
                      : "opacity-30 hover:opacity-50"
                  )}
                  style={{
                    backgroundColor: index === currentIndex ? config.dot : "#9CA3AF",
                  }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>

            {/* Lesson Card */}
            <motion.div
              key={`card-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="w-full bg-white rounded-3xl shadow-lg p-5"
            >
              {/* Lessons List */}
              <div className="space-y-1 mb-4">
                {currentCourse.lessons.map((lesson) => (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    color={currentCourse.color}
                  />
                ))}
              </div>

              {/* Continue Button */}
              <motion.button
                className={cn(
                  "w-full py-4 rounded-2xl font-semibold text-white text-lg",
                  "transition-colors",
                  config.button
                )}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                Continue Module
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
