import Link from "next/link"
import {
  ProfileOverviewV1,
  ProfileOverviewV2,
  ProfileOverviewV3,
  ProfileOverviewV4,
  ProfileOverviewV5,
  ProfileOverviewV6,
} from "@/components/repreneurs/profile-overview-variants"

export default function DevPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Profile Overview Variants
        </h1>
        <p className="text-gray-600 mt-1">
          Pick the best layout for showing Tier 1 and Tier 2 scores at a glance
        </p>
      </div>

      {/* Variants Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ProfileOverviewV1 />
        <ProfileOverviewV2 />
        <ProfileOverviewV3 />
        <ProfileOverviewV4 />
        <ProfileOverviewV5 />
        <ProfileOverviewV6 />
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-900 mb-2">Variant descriptions:</p>
        <ul className="space-y-1.5">
          <li><strong>V1 Overlapping:</strong> Both tiers on single radar (merged dimensions)</li>
          <li><strong>V2 Side-by-Side:</strong> Two mini radars horizontally</li>
          <li><strong>V3 Horizontal Bars:</strong> Progress bars for each dimension</li>
          <li><strong>V4 Compact Stacked:</strong> Current design but shorter charts</li>
          <li><strong>V5 Donut Rings:</strong> Concentric rings showing overall averages</li>
          <li><strong>V6 Summary Gauges:</strong> Two gauges with dimension labels</li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-4 border-t">
        <Link href="/guide/roadmap" className="text-blue-600 hover:underline">
          Back to Roadmap
        </Link>
      </div>
    </div>
  )
}
