"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StaleLead {
  id: string
  first_name: string
  last_name: string
  email: string
  updated_at: string
  days_stale: number
}

interface StaleLeadsProps {
  staleLeads: StaleLead[]
}

export function StaleLeads({ staleLeads }: StaleLeadsProps) {
  return (
    <Card className={cn("h-full gap-0 py-0", staleLeads.length > 5 && "border-destructive/30")}>
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className={cn(
            "size-4",
            staleLeads.length > 0 ? "text-destructive" : "text-muted-foreground"
          )} />
          Stale Leads
          {staleLeads.length > 0 && (
            <Badge variant="outline" className="ml-auto border-destructive/20 bg-destructive/5 text-destructive">
              {staleLeads.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Leads without recent activity or follow-up.</CardDescription>
      </CardHeader>
      <CardContent className="py-3">
        {staleLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="size-8 text-success mb-2" />
            <p className="text-sm font-medium text-foreground">No stale leads</p>
            <p className="text-xs text-muted-foreground mt-1">
              All leads have been updated in the last 7 days
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {staleLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/repreneurs/${lead.id}`}
                className="group flex items-center justify-between border-b px-1 py-2.5 transition-colors last:border-b-0 hover:bg-destructive/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-destructive">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-2 shrink-0 text-[10px] px-1.5 py-0",
                    lead.days_stale >= 14
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-destructive/20 bg-destructive/5 text-destructive"
                  )}
                >
                  {lead.days_stale}d ago
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
