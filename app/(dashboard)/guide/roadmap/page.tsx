import Link from "next/link"
import { DevelopmentRoadmap } from "@/components/guide"

export const revalidate = 3600 // Cache for 1 hour

export default function RoadmapPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Roadmap
        </h1>
        <p className="text-gray-600 mt-2">
          The development journey of Wave
        </p>
      </div>

      {/* Development Roadmap */}
      <DevelopmentRoadmap />

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-8 border-t">
        <p>
          See the <Link href="/guide" className="text-blue-600 hover:underline">Mission</Link> for the vision
          behind Wave, or <Link href="/guide/instructions" className="text-blue-600 hover:underline">Instructions</Link> to
          learn how to use the platform.
        </p>
      </div>
    </div>
  )
}
