#!/usr/bin/env tsx

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { syntheticPdfBytes } from "../lib/__tests__/fixtures/synthetic-pdf";
import { openingReadinessRunLabel } from "../lib/opening-readiness-fixture";

if (
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_CONTRACT_MODE !== "protected"
) {
  throw new Error(
    "Opening fixture inputs require protected GitHub Actions mode.",
  );
}

const releaseSha = process.env.OPENING_FIXTURE_RELEASE_SHA;
const runnerTemp = process.env.RUNNER_TEMP;
if (!releaseSha || !runnerTemp) {
  throw new Error(
    "Opening fixture inputs require release SHA and runner temp.",
  );
}

const inputDirectory = join(runnerTemp, "opening-readiness-inputs");
await mkdir(inputDirectory, { recursive: true });

const inputs = [
  { key: "blankNda", fileName: "qa-opening-blank-nda.pdf", pages: 1 },
  {
    key: "informationMemorandum",
    fileName: "qa-opening-information-memorandum.pdf",
    pages: 2,
  },
] as const;

const files: Record<string, { path: string; bytes: number; sha256: string }> =
  {};
for (const input of inputs) {
  const bytes = syntheticPdfBytes(input.pages);
  const path = join(inputDirectory, input.fileName);
  await writeFile(path, bytes);
  files[input.key] = {
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const manifest = {
  runLabel: openingReadinessRunLabel(releaseSha),
  releaseSha,
  synthetic: true,
  retainedAfterRunner: false,
  files,
};
await writeFile(
  join(inputDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(manifest)}\n`);
