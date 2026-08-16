"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { confirmExternalPursuitCurrent } from "@/lib/actions/external-pursuit-capacity"
import type { ExternalPursuitOperationLockHandler } from "@/lib/external-pursuit-operation-lock"
import {
  beginExternalPursuitConfirmation,
  EMPTY_EXTERNAL_PURSUIT_CONFIRMATION_STATE,
  settleExternalPursuitConfirmation,
} from "@/lib/utils/external-pursuit-confirmation"

/** Owner-board mount: one frozen idempotency key survives an unknown response. */
export function ExternalPursuitConfirmCurrentButton({
  pursuitId,
  onOperationLockChange,
  onConfirmed,
}: {
  pursuitId: string
  onOperationLockChange?: ExternalPursuitOperationLockHandler
  onConfirmed?: () => void
}) {
  const stateRef = useRef(EMPTY_EXTERNAL_PURSUIT_CONFIRMATION_STATE)
  const lockToken = useRef(`confirmation:${pursuitId}:${crypto.randomUUID()}`)
  const [pending, setPending] = useState(false)
  const [retryPending, setRetryPending] = useState(false)

  useEffect(() => {
    if (!retryPending) return
    onOperationLockChange?.({ token: lockToken.current, delta: 1 })
    return () => onOperationLockChange?.({ token: lockToken.current, delta: -1 })
  }, [onOperationLockChange, retryPending])

  async function confirm() {
    const start = beginExternalPursuitConfirmation(
      stateRef.current,
      pursuitId,
      () => crypto.randomUUID(),
    )
    if (!start.started) return
    stateRef.current = start.state
    setPending(true)
    try {
      const result = await confirmExternalPursuitCurrent(
        start.attempt.pursuitId,
        start.attempt.idempotencyKey,
      )
      stateRef.current = settleExternalPursuitConfirmation(stateRef.current, result.outcome)
      setRetryPending(stateRef.current.pending !== null)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      onConfirmed?.()
    } catch {
      stateRef.current = settleExternalPursuitConfirmation(stateRef.current, "ambiguous")
      setRetryPending(true)
      toast.error("Confirmation result is unknown. Retry the same confirmation.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={confirm} disabled={pending}>
      {pending ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
      {pending ? "Confirming…" : retryPending ? "Retry confirmation" : "Confirm current"}
    </Button>
  )
}
