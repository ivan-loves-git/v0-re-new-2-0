"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, TrendingUp } from "lucide-react"
import type { OfferConversionData } from "@/lib/actions/analytics"

interface OfferConversionProps {
  data: OfferConversionData
}

export function OfferConversion({ data }: OfferConversionProps) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Offer conversion</CardTitle>
        <CardDescription>Speed to offer, acceptance, and offer-type performance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 py-4">
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Time to Offer Sent */}
          <div className="flex flex-col gap-1 border-b pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Time to Offer Sent
            </div>
            <span className="text-2xl font-bold">
              {data.medianTimeToOfferSent !== null ? `${data.medianTimeToOfferSent}d` : "—"}
            </span>
            <span className="text-xs text-muted-foreground">median days</span>
          </div>

          {/* Time to Offer Accepted */}
          <div className="flex flex-col gap-1 border-b pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Time to Accepted
            </div>
            <span className="text-2xl font-bold">
              {data.medianTimeToOfferAccepted !== null ? `${data.medianTimeToOfferAccepted}d` : "—"}
            </span>
            <span className="text-xs text-muted-foreground">median days</span>
          </div>

          {/* Overall Acceptance Rate */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Acceptance Rate
            </div>
            <span className="text-2xl font-bold">{data.overallAcceptanceRate}%</span>
            <span className="text-xs text-muted-foreground">overall</span>
          </div>
        </div>

        {/* Acceptance by Offer */}
        {data.acceptanceByOffer.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              By Offer Type
            </p>
            <div className="flex flex-col gap-1.5">
              {data.acceptanceByOffer.map((offer) => (
                <div key={offer.offerName} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
                  <span className="text-sm font-medium">{offer.offerName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {offer.accepted}/{offer.sent} sent
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        offer.rate >= 50
                          ? "bg-success/10 text-success"
                          : offer.rate > 0
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {offer.rate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.acceptanceByOffer.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No offers sent yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}
