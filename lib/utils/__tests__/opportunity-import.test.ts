import { describe, expect, it } from "vitest"
import {
  normalizeOpportunityRows,
  parseDelimitedOpportunityRows,
} from "@/lib/utils/opportunity-import"

describe("opportunity import", () => {
  it("normalizes a safe one-row French workbook fixture before import", () => {
    const rows = parseDelimitedOpportunityRows(
      [
        "Réf. Mandat\tCabinet\tSecteur\tLocalisation\tDescription\tCA M€\tEBE K€\tEffectif",
        "DEMO-775-001\tCabinet Démo\tServices aux entreprises (B2B)\tLyon\tEntreprise de démonstration\t3,4\t620\t18",
      ].join("\n"),
    )

    const [result] = normalizeOpportunityRows(rows)

    expect(result.isValid).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(result.draft).toMatchObject({
      reference: "DEMO-775-001",
      source_label: "Cabinet Démo",
      public_title: "Services aux entreprises (B2B) - Lyon",
      revenue_meur: 3.4,
      ebitda_keur: 620,
      headcount: 18,
      headcount_range: "18",
    })
  })

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

  it("keeps legacy Activity workbook imports compatible", () => {
    const [result] = normalizeOpportunityRows([
      {
        Reference: "OPP-LEGACY-ACTIVITY",
        Activity: "Services",
        Location: "Paris",
      },
    ])

    expect(result.isValid).toBe(true)
    expect(result.draft.sector).toBe("Services")
    expect(result.draft.activity).toBe("Services")
    expect(result.draft.public_title).toBe("Services - Paris")
  })

  it("uses a supplied public title and trims it before import", () => {
    const [result] = normalizeOpportunityRows([
      {
        Reference: "OPP-PUBLIC-TITLE",
        "Public title": "  Independent marine equipment business  ",
        Sector: "Services",
        Location: "Nantes",
      },
    ])

    expect(result.isValid).toBe(true)
    expect(result.draft.public_title).toBe(
      "Independent marine equipment business",
    )
  })

  it("blocks rows that cannot provide a public title", () => {
    const [result] = normalizeOpportunityRows([
      {
        Reference: "OPP-NO-PUBLIC-TITLE",
        Location: "Paris",
        "Public title": "   ",
      },
    ])

    expect(result.isValid).toBe(false)
    expect(result.diagnostics).toContainEqual({
      severity: "blocker",
      field: "public_title",
      message:
        "Missing public title. Provide Public title or a sector/activity to derive one.",
    })
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
