import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { WaveBarChart } from "@/components/wave/charts"

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
  const stages = [
    { stage: "Leads", count: leadCount },
    { stage: "Qualified", count: qualifiedCount },
    { stage: "Clients", count: clientCount },
  ]

  const conversions = [
    { from: "Lead", to: "Qualified", rate: leadToQualifiedRate },
    { from: "Qualified", to: "Client", rate: qualifiedToClientRate },
    { from: "Lead", to: "Client", rate: leadToClientRate },
  ]

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Conversion funnel</CardTitle>
        <CardDescription>Current lifecycle mix with the recorded progression rates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <WaveBarChart data={stages} label="Conversion funnel stage counts" xKey="stage" series={[{ key: "count", label: "Repreneurs" }]} className="h-[220px]" />

        {/* Conversion rates */}
        <div className="border-t pt-3 space-y-2">
          {conversions.map((c) => (
            <div key={`${c.from}-${c.to}`} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {c.from} &rarr; {c.to}
              </span>
              <span className={cn(
                "font-semibold tabular-nums",
                c.rate >= 50 ? "text-success" : c.rate >= 25 ? "text-warning" : "text-muted-foreground"
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
