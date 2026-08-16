import { describe, expect, it } from "vitest"
import {
  hasExternalPursuitOperationLocks,
  updateExternalPursuitOperationLocks,
} from "@/lib/external-pursuit-operation-lock"

describe("External Pursuit composed operation locks", () => {
  it("does not let files unlock an active follow-up operation", () => {
    let locks = updateExternalPursuitOperationLocks(new Map(), { token: "follow-up", delta: 1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "files", delta: 1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "files", delta: -1 })

    expect(hasExternalPursuitOperationLocks(locks)).toBe(true)
    expect(locks.get("follow-up")).toBe(1)
  })

  it("reference-counts repeated acquisition and ignores stray release", () => {
    let locks = updateExternalPursuitOperationLocks(new Map(), { token: "files", delta: 1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "files", delta: 1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "files", delta: -1 })
    expect(hasExternalPursuitOperationLocks(locks)).toBe(true)

    locks = updateExternalPursuitOperationLocks(locks, { token: "files", delta: -1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "missing", delta: -1 })
    expect(hasExternalPursuitOperationLocks(locks)).toBe(false)
  })

  it("keeps the manager dialog locked while an ambiguous conversion waits for its exact retry", () => {
    let locks = updateExternalPursuitOperationLocks(new Map(), { token: "conversion:dossier-1:attempt", delta: 1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "follow-up", delta: 1 })
    locks = updateExternalPursuitOperationLocks(locks, { token: "follow-up", delta: -1 })

    expect(hasExternalPursuitOperationLocks(locks)).toBe(true)
    expect(locks.get("conversion:dossier-1:attempt")).toBe(1)

    locks = updateExternalPursuitOperationLocks(locks, { token: "conversion:dossier-1:attempt", delta: -1 })
    expect(hasExternalPursuitOperationLocks(locks)).toBe(false)
  })
})
