import { SwipeCourseSelector } from "@/components/learnings/swipe-course-selector"

export default function LearningsTestPage() {
  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Repreneur Learning Path</h1>
        <p className="text-gray-500 mt-1">
          Your guided journey to successful business acquisition
        </p>
      </div>

      {/* The swipe component */}
      <SwipeCourseSelector />

      {/* Technical Notes - collapsed at bottom */}
      <details className="mt-8 max-w-2xl mx-auto">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
          Technical Implementation Notes
        </summary>
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <div className="p-3 bg-gray-100 rounded-lg">
            <span className="font-medium text-gray-900">Animation:</span> Framer Motion spring (stiffness: 300, damping: 30)
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <span className="font-medium text-gray-900">Snap:</span> 20% threshold + 500px/s velocity detection
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <span className="font-medium text-gray-900">Transitions:</span> Staggered opacity/scale animations
          </div>
        </div>
      </details>
    </div>
  )
}
