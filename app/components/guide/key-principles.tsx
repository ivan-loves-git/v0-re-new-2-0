"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Package, Zap, BarChart3 } from "lucide-react"

const principles = [
  {
    icon: Users,
    title: "Client Lifecycle Logic",
    description: "Repreneurs are managed as clients, not candidates. Each person has a single consolidated profile that tracks their entire journey with Re-New — from initial contact to active client across multiple offers.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    icon: Package,
    title: "Offer-Centric Management",
    description: "Re-New operates through offers (Starter Pack, Deal Flow, Sparring Partner). The platform tracks which offers are assigned to which clients, their status, milestones, and deliverables.",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    icon: Zap,
    title: "Action-Driven Status",
    description: "Status changes happen automatically based on actions — not manual drag-and-drop. Set Tier 2 stars → becomes Qualified. Assign an offer → becomes Client. This ensures data consistency.",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    icon: BarChart3,
    title: "Pipeline Pilotage",
    description: "The platform provides clear visibility into leads, qualified prospects, and active clients. Scoring, segmentation, and activity tracking help prioritize and manage the pipeline effectively.",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
]

export function KeyPrinciples() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Key Principles</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {principles.map((principle) => (
          <Card key={principle.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className={`p-2 rounded-lg ${principle.bgColor}`}>
                  <principle.icon className={`h-4 w-4 ${principle.color}`} />
                </div>
                {principle.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{principle.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
