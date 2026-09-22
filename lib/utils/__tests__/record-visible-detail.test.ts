import { describe, expect, it, vi } from "vitest"
import { recordVisibleDetail } from "@/lib/utils/record-visible-detail"
function page(initial: DocumentVisibilityState = "hidden") {
  const events = new EventTarget()
  return { visibilityState: initial, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), change() { events.dispatchEvent(new Event("visibilitychange")) } }
}
const callbacks = () => ({ start: vi.fn(), result: vi.fn(), error: vi.fn(), settled: vi.fn() })
describe("authorized visible detail lifetime", () => {
  it("does not record hidden detail and records once when visible, even after repeated visibility events", async () => {
    const doc = page(), record = vi.fn().mockResolvedValue({ ok: true }), cb = callbacks()
    const cleanup = recordVisibleDetail(doc, record, cb)
    doc.change()
    expect(record).not.toHaveBeenCalled()
    doc.visibilityState = "visible"; doc.change(); doc.change()
    await Promise.resolve()
    expect(record).toHaveBeenCalledTimes(1)
    expect(cb.result).toHaveBeenCalledWith({ ok: true })
    cleanup()
    doc.change()
    expect(record).toHaveBeenCalledTimes(1)
  })
  it("never records a hidden detail unmounted before it becomes visible", () => {
    const doc = page(), record = vi.fn()
    recordVisibleDetail(doc, record, callbacks())()
    doc.visibilityState = "visible"; doc.change()
    expect(record).not.toHaveBeenCalled()
  })
  it("reports failure and allows an explicit fresh attempt without inventing success", async () => {
    const doc = page("visible"), record = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true }), cb = callbacks()
    const cleanup = recordVisibleDetail(doc, record, cb)
    await Promise.resolve(); await Promise.resolve()
    expect(cb.error).toHaveBeenCalledTimes(1)
    expect(cb.result).not.toHaveBeenCalled()
    cleanup()
    recordVisibleDetail(doc, record, cb)()
    await Promise.resolve()
    expect(record).toHaveBeenCalledTimes(2)
    // Results after unmount are ignored rather than updating a different deal.
    expect(cb.result).not.toHaveBeenCalled()
  })
})
