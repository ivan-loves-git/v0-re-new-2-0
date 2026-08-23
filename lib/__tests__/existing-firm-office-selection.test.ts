import { describe, expect, it } from "vitest"
import {
  existingFirmEligibleOfficeOptions,
  isExistingFirmOfficeSelection,
} from "@/lib/utils/existing-firm-office-selection"
import type { MaOfficeIntakeOffice } from "@/lib/types/opportunity"

const office = (
  office_id: string,
  firm_id: string,
  options: Partial<MaOfficeIntakeOffice> = {},
): MaOfficeIntakeOffice => ({
  office_id,
  firm_id,
  firm_name: firm_id === "firm-a" ? "Firm A" : "Firm B",
  firm_status: "active",
  office_name: "Paris",
  office_label: "Firm — Paris",
  contacts: [],
  ...options,
})

describe("existing-firm office selection", () => {
  it("shows only the selected firm's active intake-eligible offices", () => {
    const options = existingFirmEligibleOfficeOptions("firm-a", [
      office("office-a-real", "firm-a", { is_default: false }),
      office("office-a-default", "firm-a", { is_default: true }),
      office("office-b-real", "firm-b", { is_default: false }),
      office("office-a-prospect", "firm-a", { firm_status: "prospect" }),
    ])

    expect(options.map((item) => item.office_id)).toEqual(["office-a-real"])
  })

  it("offers a synthetic default only when that firm has no real active office", () => {
    expect(
      existingFirmEligibleOfficeOptions("firm-a", [
        office("office-a-default", "firm-a", { is_default: true }),
      ]).map((item) => item.office_id),
    ).toEqual(["office-a-default"])
  })

  it("accepts a selected office only while it remains eligible for that firm", () => {
    const offices = [
      office("office-a", "firm-a"),
      office("office-b", "firm-b"),
    ]

    expect(isExistingFirmOfficeSelection("office-a", "firm-a", offices)).toBe(
      true,
    )
    expect(isExistingFirmOfficeSelection("office-a", "firm-b", offices)).toBe(
      false,
    )
    expect(isExistingFirmOfficeSelection("office-b", "firm-a", offices)).toBe(
      false,
    )
  })
})
