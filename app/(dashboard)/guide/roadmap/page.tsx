import { DevelopmentRoadmap } from "@/components/guide"

export const revalidate = 3600 // Cache for 1 hour

export default function RoadmapPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Development Roadmap */}
      <DevelopmentRoadmap />

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-8 border-t">
        <p>Roadmap is the active project reference for current delivery scope and completed platform work.</p>
      </div>
    </div>
  )
}
