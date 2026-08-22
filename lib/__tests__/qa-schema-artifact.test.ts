import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  inspectSchemaArtifact,
  schemaObjectInventory,
} from "@/lib/qa/schema-artifact.mjs"

const SAFE_DDL = `
CREATE TABLE public.example (id uuid DEFAULT gen_random_uuid() NOT NULL);
CREATE FUNCTION public.create_example() RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.example(id) VALUES (gen_random_uuid());
END;
$function$;
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.example TO authenticated;
`

describe("row-free schema artifact inspection", () => {
  it("builds an order-independent inventory of public structural objects", () => {
    const headings = `-- Name: zed; Type: TABLE; Schema: public; Owner: -
-- Name: alpha(); Type: FUNCTION; Schema: public; Owner: -`
    expect(schemaObjectInventory(headings)).toEqual([
      "FUNCTION:alpha()",
      "TABLE:zed",
    ])
  })

  it("accepts structural DDL and runtime SQL inside function bodies", () => {
    expect(inspectSchemaArtifact(SAFE_DDL)).toEqual({ ok: true, findings: [] })
  })

  it("rejects top-level row-bearing statements", () => {
    for (const statement of [
      "INSERT INTO public.example VALUES ('row');",
      "COPY public.example FROM stdin;\nrow\n\\.",
      "UPDATE public.example SET id = gen_random_uuid();",
      "DELETE FROM public.example;",
      "TRUNCATE public.example;",
    ]) {
      const result = inspectSchemaArtifact(`${SAFE_DDL}\n${statement}`)
      expect(result.ok).toBe(false)
      expect(result.findings).toContain("row-bearing-statement")
    }
  })

  it("rejects production identities and domains", () => {
    for (const value of [
      "iiuqcdnmxhtyispnykgf",
      "db.iiuqcdnmxhtyispnykgf.supabase.co",
      "app.re-new.team",
    ]) {
      const result = inspectSchemaArtifact(`${SAFE_DDL}\n-- ${value}`)
      expect(result.ok).toBe(false)
      expect(result.findings).toContain("production-identity")
    }
  })

  it("rejects email-like values anywhere in the artifact", () => {
    const result = inspectSchemaArtifact(`${SAFE_DDL}\n-- person@example.com`)
    expect(result.ok).toBe(false)
    expect(result.findings).toContain("email-like-value")
  })

  it("rejects known customer identity fragments anywhere in the artifact", () => {
    for (const value of ["Bertrand", "Galas"]) {
      const result = inspectSchemaArtifact(`${SAFE_DDL}\n-- ${value}`)
      expect(result.ok).toBe(false)
      expect(result.findings).toContain("customer-identity")
    }
  })

  it("rejects secret-like tokens and connection strings", () => {
    for (const value of [
      "postgresql://user:password@db.example.test/postgres",
      `sbp_${"0123456789abcdef".repeat(2)}01234567`,
      "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature",
    ]) {
      const result = inspectSchemaArtifact(`${SAFE_DDL}\n-- ${value}`)
      expect(result.ok).toBe(false)
      expect(result.findings).toContain("secret-like-value")
    }
  })

  it("requires application DDL, RLS, and grants", () => {
    const result = inspectSchemaArtifact("CREATE TABLE public.example (id uuid);")
    expect(result.ok).toBe(false)
    expect(result.findings).toContain("missing-rls")
    expect(result.findings).toContain("missing-grants")
  })

  it("preserves LOWER comparison semantics when identity literals are sanitized", () => {
    const schema = readFileSync(`${process.cwd()}/supabase/schema/771_public_schema.sql`, "utf8")
    const sanitizer = readFileSync(`${process.cwd()}/scripts/qa/sanitize-schema-artifact.mjs`, "utf8")
    expect(schema).not.toMatch(/LOWER\([^\n]+\)\s+(?:=|IS DISTINCT FROM)\s+'TEST-schema-redacted/)
    expect(sanitizer).toContain("placeholder.toLowerCase()")
  })
})
