import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ConversionFunnelProps {
  leadCount: number
  qualifiedCount: number
  clientCount: number
  leadToQualifiedRate: number
  qualifiedToClientRate: number
  leadToClientRate: number
}

export function ConversionFunnelAnalytics({
  leadCount,
  qualifiedCount,
  clientCount,
  leadToQualifiedRate,
  qualifiedToClientRate,
  leadToClientRate,
}: ConversionFunnelProps) {
  const total = leadCount + qualifiedCount + clientCount
  const maxWidth = 100

  const stages = [
    {
      label: "Leads",
      count: leadCount,
      color: "bg-blue-500",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      width: total > 0 ? Math.max((leadCount / total) * maxWidth, 20) : maxWidth,
    },
    {
      label: "Qualified",
      count: qualifiedCount,
      color: "bg-amber-500",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      width: total > 0 ? Math.max((qualifiedCount / total) * maxWidth, 15) : 60,
    },
    {
      label: "Clients",
      count: clientCount,
      color: "bg-green-500",
      textColor: "text-green-700",
      bgColor: "bg-green-50",
      width: total > 0 ? Math.max((clientCount / total) * maxWidth, 10) : 30,
    },
  ]

  const conversions = [
    { from: "Lead", to: "Qualified", rate: leadToQualifiedRate },
    { from: "Qualified", to: "Client", rate: qualifiedToClientRate },
    { from: "Lead", to: "Client", rate: leadToClientRate },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual funnel */}
        <div className="space-y-2">
          {stages.map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="w-16 text-xs text-muted-foreground text-right shrink-0">
                {stage.label}
              </div>
              <div className="flex-1 relative">
                <div
                  className={cn("h-8 rounded-md flex items-center justify-center transition-all", stage.color)}
                  style={{ width: `${stage.width}%` }}
                >
                  <span className="text-xs font-semibold text-white">{stage.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Conversion rates */}
        <div className="border-t pt-3 space-y-2">
          {conversions.map((c) => (
            <div key={`${c.from}-${c.to}`} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {c.from} &rarr; {c.to}
              </span>
              <span className={cn(
                "font-semibold tabular-nums",
                c.rate >= 50 ? "text-green-600" : c.rate >= 25 ? "text-amber-600" : "text-gray-600"
              )}>
                {c.rate}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
