/**
 * Runs one user-initiated submission at a time.
 *
 * A disabled button is only visible after React renders, so a ref-backed gate
 * is still needed to make two immediate clicks one request.
 */
export function createSingleFlightSubmission() {
  let pending = false

  return {
    async run<T>(submission: () => Promise<T>) {
      if (pending) return

      pending = true
      try {
        return await submission()
      } finally {
        pending = false
      }
    },
  }
}
