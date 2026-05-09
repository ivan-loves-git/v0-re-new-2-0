"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BackButtonProps {
  fallbackHref?: string
  label?: string
}

export function BackButton({ fallbackHref = "/repreneurs", label = "Back" }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    // Use browser history to go back
    router.back()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleBack}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}
