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
          "flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-all",
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
          "flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-all",
          value === "whatsapp"
            ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
            : "border-border hover:border-green-500/50 hover:bg-muted/50"
        )}
      >
        <MessageCircle className="size-5" />
        <span className="font-medium">WhatsApp</span>
      </button>
    </div>
  )
}
