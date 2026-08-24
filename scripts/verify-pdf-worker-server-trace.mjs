import { existsSync, readFileSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

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

const allFiles = await filesUnder(buildDirectory);
const relativeFiles = allFiles.map((file) => relative(buildDirectory, file));
if (
  relativeFiles.some(
    (file) => file.includes("static/") && file.includes("pdf-evidence-worker"),
  )
) {
  throw new Error("pdf-worker-server-trace-static-worker-asset");
}

const traceRecords = await Promise.all(
  (await filesUnder(serverDirectory))
    .filter((file) => file.endsWith(".nft.json"))
    .map(async (file) => ({
      file,
      trace: JSON.parse(await readFile(file, "utf8")),
    })),
);
const requiredPdfjsFiles = [
  "pdfjs-dist/legacy/build/pdf.mjs",
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
];
const ndaTrace = traceRecords.find(({ file, trace }) => {
  if (!file.includes("/portal/deals/[matchId]/page.js.nft.json")) return false;
  return (trace.files || []).some((entry) => {
    const compiled = resolve(dirname(file), entry);
    try {
      return (
        existsSync(compiled) &&
        /pdfjsModulePath/.test(readFileSync(compiled, "utf8"))
      );
    } catch {
      return false;
    }
  });
});
if (!ndaTrace) throw new Error("pdf-worker-server-trace-nda-action-not-found");
for (const requiredPdfjsFile of requiredPdfjsFiles) {
  if (
    !(ndaTrace.trace.files || []).some((file) =>
      file.includes(requiredPdfjsFile),
    )
  ) {
    throw new Error(
      `pdf-worker-server-trace-pdfjs-not-traced:${requiredPdfjsFile}`,
    );
  }
}

const tracedPdf = (ndaTrace.trace.files || []).find((file) =>
  file.includes(requiredPdfjsFiles[0]),
);
const sourcePdf = resolve(dirname(ndaTrace.file), tracedPdf);
const packageRoot = sourcePdf.slice(
  0,
  sourcePdf.indexOf("/legacy/build/pdf.mjs"),
);
const copiedRoot = await mkdtemp(join(tmpdir(), "renew-pdfjs-traced-"));
try {
  await cp(packageRoot, join(copiedRoot, "pdfjs-dist"), { recursive: true });
  const copiedPdf = join(copiedRoot, "pdfjs-dist/legacy/build/pdf.mjs");
  const copiedWorker = join(
    copiedRoot,
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  if (!existsSync(copiedPdf) || !existsSync(copiedWorker))
    throw new Error("pdf-worker-server-trace-copy-incomplete");
  // Import resolution is the assertion here; PDF rendering is separately exercised
  // by the real isolated-worker test. PDF.js initializes DOMMatrix at module load.
  globalThis.DOMMatrix ||= class DOMMatrix {};
  const module = await import(pathToFileURL(copiedPdf).href);
  if (typeof module.getDocument !== "function")
    throw new Error("pdf-worker-server-trace-copied-runtime-unresolvable");
} finally {
  await rm(copiedRoot, { recursive: true, force: true });
}

console.log(
  `pdf-worker-server-trace-ok:${relative(buildDirectory, ndaTrace.file)}`,
);
