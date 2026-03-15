"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card className={cn("h-full", staleLeads.length > 5 && "border-red-200")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className={cn(
            "size-4",
            staleLeads.length > 0 ? "text-red-500" : "text-muted-foreground"
          )} />
          Stale Leads
          {staleLeads.length > 0 && (
            <Badge variant="outline" className="ml-auto border-red-200 bg-red-50 text-red-700 text-[10px]">
              {staleLeads.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-red-700 transition-colors">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-2 shrink-0 text-[10px] px-1.5 py-0",
                    lead.days_stale >= 14
                      ? "border-red-300 bg-red-100 text-red-800"
                      : "border-red-200 bg-red-50 text-red-700"
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
