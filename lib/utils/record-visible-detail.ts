/** Attach only to a successfully mounted authorized detail. Returns effect cleanup. */
export function recordVisibleDetail<T>(
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">,
  record: () => Promise<T>,
  callbacks: { start: () => void; result: (result: T) => void; error: () => void; settled: () => void },
) {
  let active = true
  let started = false
  const onVisible = async () => {
    if (!active || started || page.visibilityState !== "visible") return
    started = true
    callbacks.start()
    try {
      const result = await record()
      if (active) callbacks.result(result)
    } catch {
      if (active) callbacks.error()
    } finally {
      if (active) callbacks.settled()
    }
  }
  void onVisible()
  page.addEventListener("visibilitychange", onVisible)
  return () => { active = false; page.removeEventListener("visibilitychange", onVisible) }
}
