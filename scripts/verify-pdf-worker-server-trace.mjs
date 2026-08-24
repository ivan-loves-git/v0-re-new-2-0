import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const buildDirectory = process.argv[2] || ".next";
const serverDirectory = join(buildDirectory, "server");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return nested.flat();
}

if (!existsSync(serverDirectory)) {
  throw new Error(
    `pdf-worker-server-trace-missing-server-output:${serverDirectory}`,
  );
}

const files = await filesUnder(serverDirectory);
const relativeFiles = files.map((file) => relative(buildDirectory, file));
if (
  relativeFiles.some(
    (file) => file.includes("static/") && file.includes("pdf-evidence-worker"),
  )
) {
  throw new Error("pdf-worker-server-trace-static-worker-asset");
}

const traces = await Promise.all(
  files
    .filter((file) => file.endsWith(".nft.json"))
    .map(async (file) => JSON.parse(await readFile(file, "utf8"))),
);
const tracedFiles = traces.flatMap((trace) => trace.files || []);
for (const requiredPdfjsFile of [
  "pdfjs-dist/legacy/build/pdf.mjs",
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
]) {
  if (!tracedFiles.some((file) => file.includes(requiredPdfjsFile))) {
    throw new Error(`pdf-worker-server-trace-pdfjs-not-traced:${requiredPdfjsFile}`);
  }
}

console.log("pdf-worker-server-trace-ok");
