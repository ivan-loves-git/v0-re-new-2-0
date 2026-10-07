import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function inspectSnapshot(file, ref) {
  const path = resolve(file);
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024)
    throw new Error("Snapshot must be a file of at most 10 MiB");
  const metadata = {
    schema: 1,
    readOnly: true,
    file: path,
    bytes: stat.size,
    scope: ref ?? null,
  };
  if (
    Buffer.byteLength(
      JSON.stringify({ ...metadata, truncated: false, excerpt: "" }),
    ) > 8191
  ) {
    throw new Error("Snapshot metadata exceeds the 8 KiB output limit");
  }
  if (ref === undefined) return metadata;
  if (!/^e\d+$/.test(ref))
    throw new Error("Snapshot reference must be an exact e-number");
  const lines = readFileSync(path, "utf8").replaceAll("\r\n", "\n").split("\n");
  const starts = lines.flatMap((line, index) =>
    line.includes(`[ref=${ref}]`) ? [index] : [],
  );
  if (starts.length !== 1)
    throw new Error("Snapshot reference is missing or ambiguous");
  const start = starts[0],
    indentation = lines[start].match(/^\s*/)[0].length;
  let end = start + 1;
  while (
    end < lines.length &&
    (!lines[end].trim() || lines[end].match(/^\s*/)[0].length > indentation)
  )
    end++;
  let sensitiveIndent = null;
  const scope = lines.slice(start, end).map((line) => {
    const indent = line.match(/^\s*/)[0].length;
    if (line.trim() && sensitiveIndent !== null && indent <= sensitiveIndent)
      sensitiveIndent = null;
    if (
      /\b(password|secret|token|authorization)\b|\bBearer\s|[?&](code|key)=/i.test(
        line,
      )
    )
      sensitiveIndent = indent;
    return sensitiveIndent !== null
      ? `${" ".repeat(indent)}- [sensitive content omitted]`
      : line;
  });
  let excerpt = scope.slice(0, 60).join("\n");
  let truncated = scope.length > 60;
  // Bound the serialized UTF-8 output, including JSON escaping and the newline.
  while (
    Buffer.byteLength(JSON.stringify({ ...metadata, truncated, excerpt })) >
    8191
  ) {
    excerpt = excerpt.slice(0, Math.max(0, Math.floor(excerpt.length * 0.8)));
    truncated = true;
  }
  return { ...metadata, truncated, excerpt };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 && !(args.length === 3 && args[1] === "--ref"))
      throw new Error("Snapshot usage: <snapshot.yml> [--ref e123]");
    console.log(JSON.stringify(inspectSnapshot(args[0], args[2])));
  } catch (error) {
    console.error(
      error instanceof Error &&
        /^Snapshot (reference|must|usage|metadata)/.test(error.message)
        ? error.message
        : "Snapshot inspection failed; check the file and arguments.",
    );
    process.exitCode = 1;
  }
}
