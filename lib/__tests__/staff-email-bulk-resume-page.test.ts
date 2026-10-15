import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const actions = vi.hoisted(() => ({
  read: vi.fn(),
  prepare: vi.fn(),
  ack: vi.fn(),
  confirm: vi.fn(),
  dispatch: vi.fn(),
}))
vi.mock("@/lib/actions/staff-email-bulk", () => ({
  getStaffEmailBulk: actions.read,
  prepareStaffEmailBulk: actions.prepare,
  acknowledgeStaffEmailBulkItem: actions.ack,
  confirmStaffEmailBulk: actions.confirm,
  dispatchStaffEmailBulkItem: actions.dispatch,
}))
vi.mock("@/app/(dashboard)/emails/bulk/[id]/bulk-confirmation", () => ({
  BulkEmailConfirmation: ({
    initial,
  }: {
    initial: { batch: { id: string } }
  }) => createElement("div", null, `Saved manifest ${initial.batch.id}`),
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("Not found")
  },
}))
import StaffBulkEmailPage from "@/app/(dashboard)/emails/bulk/[id]/page"

beforeEach(() => vi.clearAllMocks())
describe("canonical saved batch recovery link", () => {
  it("reopens the same saved manifest through an actor-bound read without preparing, acknowledging, confirming or sending", async () => {
    const id = "22200000-0000-4000-8000-000000000001"
    actions.read.mockResolvedValue({ batch: { id }, items: [] })
    const page = await StaffBulkEmailPage({ params: Promise.resolve({ id }) })
    expect(renderToStaticMarkup(page)).toContain(`Saved manifest ${id}`)
    expect(actions.read).toHaveBeenCalledExactlyOnceWith(id)
    expect(actions.prepare).not.toHaveBeenCalled()
    expect(actions.ack).not.toHaveBeenCalled()
    expect(actions.confirm).not.toHaveBeenCalled()
    expect(actions.dispatch).not.toHaveBeenCalled()
  })
  it("does not create a replacement batch when its stored manifest is unavailable", async () => {
    actions.read.mockRejectedValue(new Error("Different preparer"))
    await expect(
      StaffBulkEmailPage({ params: Promise.resolve({ id: "unavailable" }) }),
    ).rejects.toThrow("Not found")
    expect(actions.prepare).not.toHaveBeenCalled()
    expect(actions.dispatch).not.toHaveBeenCalled()
  })
})
