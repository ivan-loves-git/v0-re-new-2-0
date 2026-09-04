import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), "utf8")

describe("Ticket #94 explicit REAL/DEMO creation boundary", () => {
  const migration = source("scripts/117_explicit_demo_real_creation.sql")

  it("requires a boolean classification on canonical opportunity creation and rejects it on edit", () => {
    expect(migration).toContain("opportunity_demo_classification_required")
    expect(migration).toContain("opportunity_demo_classification_create_only")
    expect(migration).toContain("ARRAY['geography_node_id','date_added_confirm_day','is_demo']")
  })

  it("persists the selected namespace and its initial actor/time before commit", () => {
    expect(migration).toContain("SET is_demo=initial_is_demo,demo_classification_created_by=NULLIF(BTRIM(p_actor),''),demo_classification_created_at=clock_timestamp()")
  })

  it("makes External Pursuit conversion supply the same required boolean", () => {
    expect(migration).toContain("p_is_demo BOOLEAN")
    expect(migration).toContain("'is_demo',p_is_demo")
    expect(source("lib/actions/external-pursuit-conversion.ts")).toContain("p_is_demo: input.isDemo")
  })

  it("renders no preselected classification control in each staff creation surface", () => {
    expect(source("components/repreneurs/repreneur-form.tsx")).toContain('RadioGroup name="demo_classification"')
    expect(source("components/opportunities/opportunity-form.tsx")).toContain('RadioGroup name="demo_classification"')
    expect(source("components/pursuits/external-pursuit-conversion-panel.tsx")).toContain("const [isDemo, setIsDemo] = useState<boolean | null>(null)")
  })
})
