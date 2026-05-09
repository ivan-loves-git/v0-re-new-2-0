"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Persona } from "@/lib/data/strategy-data"
import { cn } from "@/lib/utils"

interface PersonaSelectorProps {
  personas: Persona[]
  selectedIndex: number
  onSelect: (index: number) => void
}

const TAG_STYLES: Record<Persona["tagColor"], string> = {
  gray: "bg-gray-100 text-gray-600 border-gray-200",
  blue: "bg-blue-50 text-blue-600 border-blue-200",
  amber: "bg-amber-50 text-amber-600 border-amber-200",
}

export function PersonaSelector({ personas, selectedIndex, onSelect }: PersonaSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {personas.map((persona, index) => {
        const isActive = index === selectedIndex
        return (
          <Card
            key={persona.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-md py-4",
              isActive
                ? "ring-2 ring-emerald-500 bg-emerald-50/50"
                : "hover:border-gray-300"
            )}
            onClick={() => onSelect(index)}
          >
            <CardContent className="px-4 space-y-2">
              {/* Name + Tag */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{persona.name}</span>
                <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide font-semibold", TAG_STYLES[persona.tagColor])}>
                  {persona.tag}
                </Badge>
              </div>

              {/* Meta */}
              <p className="text-xs text-muted-foreground">
                {persona.age} | {persona.role}
              </p>

              {/* Description */}
              <p className="text-xs text-muted-foreground italic">{persona.desc}</p>

              {/* Badge dots */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: 14 }, (_, j) => (
                    <div
                      key={j}
                      className={cn(
                        "size-2 rounded-full",
                        j < persona.badges.length ? "bg-emerald-500" : "bg-gray-200"
                      )}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">{persona.badges.length}/14</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
