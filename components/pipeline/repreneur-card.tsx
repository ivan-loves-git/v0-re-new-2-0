"use client"

import { Card } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurCardProps {
  repreneur: Repreneur
  isDragging?: boolean
}

export function RepreneurCard({ repreneur, isDragging = false }: RepreneurCardProps) {
  const router = useRouter()

  return (
    <Card
      className={`p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow ${isDragging ? "opacity-50 rotate-2" : ""}`}
      onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
    >
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">
          {repreneur.first_name} {repreneur.last_name}
        </h3>
        <p className="text-xs text-muted-foreground">{repreneur.email}</p>
        <p className="text-xs text-muted-foreground">
          Added {formatDistanceToNow(new Date(repreneur.created_at), { addSuffix: true })}
        </p>
      </div>
    </Card>
  )
}
