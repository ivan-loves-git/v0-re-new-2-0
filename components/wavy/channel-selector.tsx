"use client"

import { Mail, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChannelSelectorProps {
  value: "email" | "whatsapp"
  onChange: (channel: "email" | "whatsapp") => void
}

export function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("email")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-md border p-3 text-sm transition-colors",
          value === "email"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <Mail className="size-5" />
        <span className="font-medium">Email</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("whatsapp")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-md border p-3 text-sm transition-colors",
          value === "whatsapp"
            ? "border-teal-600 bg-teal-50 text-teal-700"
            : "border-border hover:border-teal-600/50 hover:bg-muted/50"
        )}
      >
        <MessageCircle className="size-5" />
        <span className="font-medium">WhatsApp</span>
      </button>
    </div>
  )
}
