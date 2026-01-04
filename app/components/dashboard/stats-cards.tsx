"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"
import { StatusBadge } from "@/components/repreneurs/status-badge"

interface StatsCardsProps {
  totalRepreneurs: number
  leadCount: number
  qualifiedCount: number
  clientCount: number
  layout?: "horizontal" | "vertical" | "grid"
}

export function StatsCards({
  totalRepreneurs,
  leadCount,
  qualifiedCount,
  clientCount,
  layout = "horizontal",
}: StatsCardsProps) {
  const cards = [
    {
      title: "Total Repreneurs",
      value: totalRepreneurs,
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
      badge: null,
    },
    {
      title: "Leads",
      value: leadCount,
      icon: null,
      badge: <StatusBadge status="lead" />,
    },
    {
      title: "Qualified",
      value: qualifiedCount,
      icon: null,
      badge: <StatusBadge status="qualified" />,
    },
    {
      title: "Clients",
      value: clientCount,
      icon: null,
      badge: <StatusBadge status="client" />,
    },
  ]

  if (layout === "vertical") {
    return (
      <div className="space-y-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
                {card.icon || card.badge}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
                {card.icon || card.badge}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Default horizontal layout
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-semibold">{card.value}</p>
              {card.badge}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
