import { DevelopmentRoadmap } from "@/components/guide"


export default function RoadmapPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Development Roadmap */}
      <DevelopmentRoadmap />

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-8 border-t">
        <p>Roadmap is the active project reference for current delivery scope and completed platform work.</p>
      </div>
    </div>
  )
}
