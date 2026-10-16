import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Client } from "pg";
import {
  captureMaDirectoryProof,
  cleanupMaDirectoryProof,
  inspectMaDirectorySchema,
  discoverOwnedMaGraph,
  verifyMaDirectoryProof,
  verifyMaDirectoryCleanup,
  MaProofError,
} from "../lib/qa/ma-directory-proof";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      target: { type: "string", default: "disposable" },
      help: { type: "boolean" },
      "owned-file": { type: "string" },
      "manifest-file": { type: "string" },
      "approval-ref": { type: "string" },
      "run-id": { type: "string" },
    },
  });
  if (values.help) {
    console.log(
      "M&A QA: inspect (default), capture (--run-id <uuid> | --owned-file <json>), verify, preflight, cleanup, verify-cleanup --manifest-file <json>. Target defaults to disposable; use --target live explicitly. MA_QA_DATABASE_URL is required. Live preflight/cleanup also require MA_QA_ALLOW_LIVE_CLEANUP=1 and --approval-ref <owning-card-url>.",
    );
    return;
  }
  const command = positionals[0] ?? "inspect";
  if (
    positionals.length > 1 ||
    ![
      "inspect",
      "capture",
      "verify",
      "preflight",
      "cleanup",
      "verify-cleanup",
    ].includes(command) ||
    !["disposable", "live"].includes(values.target!)
  ) {
    throw new MaProofError("M&A command usage is invalid; use --help");
  }
  const databaseUrl = process.env.MA_QA_DATABASE_URL;
  if (!databaseUrl)
    throw new MaProofError("M&A QA requires its explicit MA_QA_DATABASE_URL");
  const url = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new MaProofError("M&A database configuration is invalid");
  if (
    values.target === "disposable" &&
    (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/directory")
  ) {
    throw new MaProofError("Disposable M&A QA requires loopback /directory");
  }
  const writes = command === "cleanup" || command === "preflight";
  if (
    values.target === "live" &&
    writes &&
    (process.env.MA_QA_ALLOW_LIVE_CLEANUP !== "1" ||
      !/^https:\/\/github\.com\/re-new-team\/renew-governance\/issues\/(257|260)(#issuecomment-\d+)?$/.test(
        values["approval-ref"] ?? "",
      ))
  ) {
    throw new MaProofError(
      "M&A live cleanup requires explicit treatment and an owning-card approval reference",
    );
  }
  const db = new Client({
    connectionString: databaseUrl,
    application_name: "ma-directory-proof-257",
    connectionTimeoutMillis: 5000,
  });
  try {
    await db.connect();
    if (values.target === "disposable") {
      const server = (
        await db.query(
          "SELECT current_database() AS database, host(inet_server_addr()) AS address",
        )
      ).rows[0];
      if (
        server.database !== "directory" ||
        !["127.0.0.1", "::1"].includes(server.address)
      )
        throw new MaProofError(
          "Disposable M&A QA requires loopback /directory",
        );
    }
    if (!writes) await db.query("SET default_transaction_read_only=on");
    let result: object;
    if (command === "inspect") result = await inspectMaDirectorySchema(db);
    else if (command === "capture") {
      if (!!values["owned-file"] === !!values["run-id"])
        throw new MaProofError(
          "M&A capture requires one of --run-id or --owned-file",
        );
      const owned = values["run-id"]
        ? await discoverOwnedMaGraph(db, values["run-id"])
        : JSON.parse(await readFile(values["owned-file"]!, "utf8"));
      const proof = await captureMaDirectoryProof(db, owned);
      const path = resolve(
        values["manifest-file"] ??
          `.qa-run/ma-directory-${proof.owned.runId}.json`,
      );
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, JSON.stringify(proof, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      result = {
        schema: 1,
        readOnly: true,
        manifestFile: path,
        persistedRecords: proof.rows.length,
      };
    } else {
      if (!values["manifest-file"])
        throw new MaProofError("M&A verification requires --manifest-file");
      const proof = JSON.parse(await readFile(values["manifest-file"], "utf8"));
      result =
        command === "verify"
          ? await verifyMaDirectoryProof(db, proof)
          : command === "verify-cleanup"
            ? await verifyMaDirectoryCleanup(db, proof)
            : await cleanupMaDirectoryProof(db, proof, {
                commit: command === "cleanup",
              });
    }
    console.log(JSON.stringify({ ...result, command, target: values.target }));
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof MaProofError
      ? error.message
      : "M&A verification failed; connection and row details withheld.",
  );
  process.exitCode = 1;
});
