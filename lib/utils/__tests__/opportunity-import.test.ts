import { describe, expect, it } from "vitest"
import {
  normalizeOpportunityRows,
  parseDelimitedOpportunityRows,
} from "@/lib/utils/opportunity-import"

describe("opportunity import", () => {
  it("maps workbook headers with punctuation, accents, and monetary units", () => {
    const [result] = normalizeOpportunityRows([
      {
        "Ref. Mandat": "OPP-001",
        Secteur: "Hospitality",
        Localisation: "Lyon",
        "Chiffre d'affaires (M€)": "1,5 M€",
        "EBITDA (K€)": "250 k€",
        Effectifs: "12",
      },
    ])

    expect(result.isValid).toBe(true)
    expect(result.draft.revenue_meur).toBe(1.5)
    expect(result.draft.ebitda_keur).toBe(250)
    expect(result.draft.headcount).toBe(12)
    expect(result.draft.headcount_range).toBe("12")
    expect(result.draft.sector).toBe("Hôtellerie, Restauration & Loisirs")
  })

  it("converts euro and million-euro values to stored opportunity units", () => {
    const [result] = normalizeOpportunityRows([
      {
        ID: "OPP-002",
        Sector: "Services",
        Location: "Paris",
        "CA (€)": "1 500 000 €",
        "EBE M€": "1.2 M€",
        "Nb salariés": "10-20",
      },
    ])

    expect(result.isValid).toBe(true)
    expect(result.draft.revenue_meur).toBeCloseTo(1.5)
    expect(result.draft.ebitda_keur).toBe(1200)
    expect(result.draft.headcount).toBe(10)
    expect(result.draft.headcount_range).toBe("10-20")
    expect(result.draft.sector).toBe("Services")
  })

  it("parses semicolon-delimited rows and imports numeric fields", () => {
    const rows = parseDelimitedOpportunityRows(
      "Reference;Sector;Location;Revenue (M€);EBITDA K EUR;Employees\nOPP-003;Retail;Bordeaux;2,4;480;34",
    )
    const [result] = normalizeOpportunityRows(rows)

    expect(result.isValid).toBe(true)
    expect(result.draft.revenue_meur).toBe(2.4)
    expect(result.draft.ebitda_keur).toBe(480)
    expect(result.draft.headcount).toBe(34)
    expect(result.draft.sector).toBe("Commerce, Négoce & Distribution")
  })
})
