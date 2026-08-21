import { expect, it } from "vitest"

it("deliberately fails to prove Verify blocks an unsafe candidate", () => {
  expect("unsafe candidate").toBe("blocked candidate")
})
