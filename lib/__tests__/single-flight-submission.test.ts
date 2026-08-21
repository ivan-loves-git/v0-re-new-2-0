import { describe, expect, it, vi } from "vitest"
import { createSingleFlightSubmission } from "@/lib/utils/single-flight-submission"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe("single-flight submission", () => {
  it("dispatches one action when a staff user submits twice before the first request resolves", async () => {
    const gate = createSingleFlightSubmission()
    const request = deferred<void>()
    const createRepreneur = vi.fn(() => request.promise)

    const firstSubmit = gate.run(createRepreneur)
    const secondSubmit = gate.run(createRepreneur)

    expect(createRepreneur).toHaveBeenCalledTimes(1)

    request.resolve()
    await expect(firstSubmit).resolves.toBeUndefined()
    await expect(secondSubmit).resolves.toBeUndefined()
  })

  it("allows a retry after the previous request finishes", async () => {
    const gate = createSingleFlightSubmission()
    const createRepreneur = vi.fn().mockResolvedValue(undefined)

    await gate.run(createRepreneur)
    await gate.run(createRepreneur)

    expect(createRepreneur).toHaveBeenCalledTimes(2)
  })
})
