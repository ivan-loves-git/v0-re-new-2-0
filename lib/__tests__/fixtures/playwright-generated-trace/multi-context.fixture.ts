import { expect, test } from "@playwright/test"

test("multi-context retry trace fixture", async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const firstPage = await first.newPage()
  const secondPage = await second.newPage()

  await firstPage.setContent("<button>First safe action</button>")
  await secondPage.setContent("<button>Second safe action</button>")
  await firstPage.getByRole("button").click()
  await secondPage.getByRole("button").click()
  await first.close()
  await second.close()

  expect(test.info().retry).toBe(-1)
})
