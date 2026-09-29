import { DevelopmentRoadmap } from "@/components/guide"
import Link from "next/link"


export default function RoadmapPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <p className="rounded-md border p-3 text-sm text-muted-foreground">This roadmap is a historical editorial timeline. For current approved strategy and completed Product Changes, use the protected <Link className="underline underline-offset-4" href="/strategic-pdr">Strategic PDR</Link>; GitHub remains the delivery authority.</p>
      {/* Development Roadmap */}
      <DevelopmentRoadmap />

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-8 border-t">
        <p>Historical narrative. Its entries are not a current delivery or KPI record.</p>
      </div>
    </div>
  )
}
