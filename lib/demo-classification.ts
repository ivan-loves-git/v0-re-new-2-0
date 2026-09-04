export type DemoClassificationChoice = "real" | "demo"

export function parseExplicitDemoClassification(value: FormDataEntryValue | null): {
  value: boolean | null
  error: string | null
} {
  if (value === "real") return { value: false, error: null }
  if (value === "demo") return { value: true, error: null }
  return { value: null, error: "Choose REAL or DEMO before creating this record." }
}
