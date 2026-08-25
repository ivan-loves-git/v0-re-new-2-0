import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

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
const tracedWorker = (ndaTrace.trace.files || []).find((file) =>
  file.includes(requiredPdfjsFiles[1]),
);
const sourcePdf = resolve(dirname(ndaTrace.file), tracedPdf);
const sourceWorker = resolve(dirname(ndaTrace.file), tracedWorker);
const copiedRoot = await mkdtemp(join(tmpdir(), "renew-pdfjs-traced-"));

function syntheticPdfBytes() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let source = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(source, "latin1"));
    source += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(source, "latin1");
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(source, "latin1"));
}

async function parseWithCopiedRuntime(pdfPath, workerPath, bytes) {
const source = String.raw`
const { parentPort, workerData } = require("node:worker_threads")
globalThis.DOMMatrix ||= class DOMMatrix {}
parentPort.once("message", async (buffer) => {
  let loadingTask
  try {
    await import(workerData.workerPath)
    const { getDocument } = await import(workerData.pdfPath)
    loadingTask = getDocument({
      data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false,
      stopAtErrors: true, useSystemFonts: false, verbosity: 0,
    })
    const document = await loadingTask.promise
    parentPort.postMessage({ ok: true, pages: document.numPages })
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "unknown parser error",
    })
  } finally {
    if (loadingTask) await loadingTask.destroy().catch(() => undefined)
  }
})
`;
  return new Promise((resolveResult, rejectResult) => {
    let settled = false;
    const runtimeWorker = new Worker(source, {
      eval: true,
      workerData: {
        pdfPath: pathToFileURL(pdfPath).href,
        workerPath: pathToFileURL(workerPath).href,
      },
    });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      void runtimeWorker.terminate();
      if (error) rejectResult(error);
      else resolveResult(result);
    };
    const deadline = setTimeout(() => {
      finish(new Error("pdf-worker-server-trace-runtime-timeout"));
    }, 5_000);
    runtimeWorker.once("message", (result) => {
      finish(undefined, result);
    });
    runtimeWorker.once("error", (error) => {
      finish(error);
    });
    runtimeWorker.once("exit", () => {
      finish(new Error("pdf-worker-server-trace-runtime-exit"));
    });
    const input = Uint8Array.from(bytes);
    runtimeWorker.postMessage(input.buffer, [input.buffer]);
  });
}

try {
  const copiedPdf = join(copiedRoot, "pdfjs-dist/legacy/build/pdf.mjs");
  const copiedWorker = join(
    copiedRoot,
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  await mkdir(dirname(copiedPdf), { recursive: true });
  await Promise.all([cp(sourcePdf, copiedPdf), cp(sourceWorker, copiedWorker)]);
  if (!existsSync(copiedPdf) || !existsSync(copiedWorker))
    throw new Error("pdf-worker-server-trace-copy-incomplete");
  const validResult = await parseWithCopiedRuntime(
    copiedPdf,
    copiedWorker,
    syntheticPdfBytes(),
  );
  if (!validResult?.ok || validResult.pages !== 1) {
    throw new Error(
      `pdf-worker-server-trace-valid-pdf-rejected:${validResult?.error ?? "unknown"}`,
    );
  }
  const malformedResult = await parseWithCopiedRuntime(
    copiedPdf,
    copiedWorker,
    new TextEncoder().encode("%PDF-1.4\n%%EOF\n"),
  );
  if (malformedResult?.ok) {
    throw new Error("pdf-worker-server-trace-malformed-pdf-accepted");
  }
} finally {
  await rm(copiedRoot, { recursive: true, force: true });
}

console.log(
  `pdf-worker-server-trace-ok:${relative(buildDirectory, ndaTrace.file)}`,
);
