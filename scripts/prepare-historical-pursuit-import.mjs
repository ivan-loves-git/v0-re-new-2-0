#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileHistoricalPursuits } from "./historical-pursuit-manifest.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  throw new Error(
    "Usage: node scripts/prepare-historical-pursuit-import.mjs <workbook.xlsx> <read-only-wave-snapshot.json> <output-manifest.json>",
  );
}

const [workbook, snapshotPath, outputPath, ...extra] = process.argv.slice(2);
if (!workbook || !snapshotPath || !outputPath || extra.length > 0) usage();
if (path.resolve(workbook) === path.resolve(outputPath)) {
  throw new Error("Workbook and output paths must differ.");
}
const source = JSON.parse(
  execFileSync("python3", [path.join(scriptDirectory, "parse-historical-pursuit-workbook.py"), workbook], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  }),
);
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const manifest = reconcileHistoricalPursuits(source, snapshot);
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
process.stdout.write(`${JSON.stringify(manifest.summary)}\n`);
