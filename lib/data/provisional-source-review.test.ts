import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("staff generic source-identity marker", () => {
  it("uses the persisted generic flag and keeps identity tuples out of app code", () => {
    const source = readFileSync(resolve(__dirname, "provisional-source-review.ts"), "utf8");
    expect(source).toContain("opportunity.source_identity_to_verify === true");
    expect(source).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
