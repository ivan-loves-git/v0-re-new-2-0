"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { type Persona } from "@/lib/data/strategy-data"
import { Users } from "lucide-react"

interface SellerViewProps {
  persona: Persona
  scores: number[]
  enabled: boolean
  onToggle: (value: boolean) => void
}

function bar(score: number): string {
  return "=".repeat(score) + " ".repeat(9 - score)
}

export function SellerView({ persona, scores, enabled, onToggle }: SellerViewProps) {
  const roundedScores = scores.map((s) => Math.round(s))
  const badgeList = persona.badges.join(", ")

  const renewProfile = `REPRENEUR PROFILE: ${persona.name}
Re-New Certified: ${persona.tag} | Phase: ${persona.phase}/13

Readiness Radar:
  Financial Capacity:     ${bar(roundedScores[0])} ${roundedScores[0]}/9
  Industry Expertise:     ${bar(roundedScores[1])} ${roundedScores[1]}/9
  Deal Experience:        ${bar(roundedScores[2])} ${roundedScores[2]}/9
  Operational Capability: ${bar(roundedScores[3])} ${roundedScores[3]}/9
  Network Strength:       ${bar(roundedScores[4])} ${roundedScores[4]}/9
  Process Maturity:       ${bar(roundedScores[5])} ${roundedScores[5]}/9

Target: ${persona.target.sector} | ${persona.target.size} | ${persona.target.region}

Certifications: ${badgeList}`

  const genericProfile = `CANDIDATE PROFILE: Anonymous Buyer

"Interested buyer, 15 years business
experience, has financing."

No verification. No readiness data.
No certification. No details.`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-purple-600" />
          Seller Perspective
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toggle */}
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} />
          <span className="text-xs text-muted-foreground">What the seller sees</span>
        </div>

        {!enabled ? (
          <div className="flex items-center justify-center min-h-[200px] text-center text-sm text-muted-foreground px-4 leading-relaxed">
            Toggle on to see how Re-New presents this repreneur to sellers and intermediaries vs. a generic candidate.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Re-New Profile */}
            <p className="text-xs font-semibold text-emerald-600">Re-New Certified Profile</p>
            <pre className="bg-muted/50 border border-emerald-200 border-l-[3px] border-l-emerald-500 rounded-lg p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
              {renewProfile}
            </pre>

            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">vs.</p>

            {/* Generic Profile */}
            <p className="text-xs font-semibold text-red-500">Generic Candidate</p>
            <pre className="bg-muted/30 border border-red-200 border-l-[3px] border-l-red-400 rounded-lg p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words opacity-60">
              {genericProfile}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
