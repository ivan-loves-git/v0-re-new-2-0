import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function inspect(text: string, ...args: string[]) {
  const root = mkdtempSync(join(tmpdir(), "renew-snapshot-"));
  roots.push(root);
  const file = join(root, "synthetic.yml");
  writeFileSync(file, text);
  return spawnSync(
    process.execPath,
    [resolve("scripts/agent-snapshot.mjs"), file, ...args],
    { encoding: "utf8" },
  );
}
describe("bounded snapshot command", () => {
  it("returns metadata alone by default, without background records", () => {
    const result = inspect(
      "- main [ref=e1]:\n  - text: irrelevant private background\n",
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: 1,
      readOnly: true,
      scope: null,
    });
    expect(result.stdout).not.toContain("irrelevant private background");
  });
  it("reads only the requested dialog and caps the whole Unicode output", () => {
    const background = Array.from(
      { length: 5000 },
      (_, i) => `  - row: background-${i}`,
    ).join("\n");
    const result = inspect(
      `- main [ref=e1]:\n${background}\n- dialog "Add firm" [ref=e2]:\n  - text: ${"界".repeat(9000)}\n- footer [ref=e3]: private footer\n`,
      "--ref",
      "e2",
    );
    expect(result.status).toBe(0);
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(8192);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ scope: "e2", truncated: true });
    expect(output.excerpt).toContain('dialog "Add firm"');
    expect(result.stdout).not.toContain("background-");
    expect(result.stdout).not.toContain("private footer");
  });
  it("does not emit a password control or its nested value", () => {
    const result = inspect(
      '- dialog [ref=e2]:\n  - textbox "Password" [ref=e4]:\n    - value: never-emit-this\n  - button "Save" [ref=e5]\n',
      "--ref",
      "e2",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("never-emit-this");
    expect(JSON.parse(result.stdout).excerpt).toContain('button "Save"');
  });
  it.each(["- dialog [ref=e2]\n- dialog [ref=e2]\n", "- main [ref=e1]\n"])(
    "refuses ambiguous or missing references",
    (text) => {
      const result = inspect(text, "--ref", "e2");
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("missing or ambiguous");
    },
  );
});
