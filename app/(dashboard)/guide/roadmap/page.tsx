import { DevelopmentRoadmap } from "@/components/guide"


export default function RoadmapPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Development Roadmap */}
      <DevelopmentRoadmap />

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-8 border-t">
        <p>This is a historical editorial timeline. Current scope, decisions and delivery evidence live in Re-New Product Delivery on GitHub.</p>
      </div>
    </div>
  )
}
