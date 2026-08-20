"use client"

import { useSyncExternalStore } from "react"
import { formatDisplayDate } from "@/lib/utils/display-date-time"

/**
 * Deliberately withholds the moving clock until after React has hydrated.
 * Server rendering and the browser's first render therefore agree exactly.
 */
let hydratedNow: number | null = null
const listeners = new Set<() => void>()
const REFRESH_INTERVAL_MS = 60_000
let refreshTimer: ReturnType<typeof setInterval> | null = null

function refreshHydratedNow() {
  hydratedNow = Date.now()
  for (const listener of listeners) listener()
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  if (listeners.size === 1) {
    refreshHydratedNow()
    refreshTimer = setInterval(refreshHydratedNow, REFRESH_INTERVAL_MS)
  } else {
    onStoreChange()
  }

  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0) {
      if (refreshTimer !== null) clearInterval(refreshTimer)
      refreshTimer = null
      hydratedNow = null
    }
  }
}

function getSnapshot() {
  return hydratedNow
}

function getServerSnapshot() {
  return null
}

export function useHydratedNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export const __hydratedNowTest = {
  getSnapshot,
  getServerSnapshot,
  reset: () => {
    if (refreshTimer !== null) clearInterval(refreshTimer)
    refreshTimer = null
    listeners.clear()
    hydratedNow = null
  },
  subscribe,
}

/** A deterministic, human-readable initial label in the operating timezone. */
export function initialDateLabel(value: string) {
  return formatDisplayDate(value, "en-GB")
}
