'use client'

import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { SHOW_AUTOFILL } from '@/lib/config/intake-test-data'

interface AutofillButtonProps {
  onAutofill: () => void
  label?: string
}

/**
 * Quick autofill button for testing
 * Only visible when NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true
 */
export function AutofillButton({ onAutofill, label = 'Autofill' }: AutofillButtonProps) {
  if (!SHOW_AUTOFILL) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onAutofill}
      className="absolute top-2 right-2 text-xs bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800"
    >
      <Zap className="h-3 w-3 mr-1" />
      {label}
    </Button>
  )
}
