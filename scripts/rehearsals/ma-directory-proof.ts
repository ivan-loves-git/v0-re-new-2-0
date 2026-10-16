import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import {
  captureMaDirectoryProof,
  cleanupMaDirectoryProof,
  verifyMaDirectoryProof,
} from "../../lib/qa/ma-directory-proof";

async function main() {
  const url = process.env.MA_QA_DATABASE_URL;
  if (
    !url ||
    new URL(url).hostname !== "127.0.0.1" ||
    new URL(url).pathname !== "/directory"
  ) {
    throw new Error(
      "M&A tooling rehearsal requires its disposable directory database",
    );
  }
  const db = new Client({ connectionString: url });
  const artifacts = mkdtempSync(join(tmpdir(), "renew-ma-proof-"));
  function command(mode: string, ...args: string[]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", resolve("scripts/qa-ma-directory.ts"), mode, ...args],
      {
        encoding: "utf8",
        env: { ...process.env, MA_QA_DATABASE_URL: url },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  await db.connect();
  try {
    const runId = randomUUID();
    const prefix = `QA 257 ${runId} `;
    const graph = (
      await db.query(
        `SELECT * FROM public.create_ma_firm_with_first_office(
    $1,'Central','Lyon',TRUE,$2,NULL,NULL,'+33 1 00 00 00 00',NULL,'staff-257')`,
        [prefix + "Advisory", prefix + "Person"],
      )
    ).rows[0];
    const owned = {
      runId,
      firms: [graph.firm_id],
      offices: [graph.office_id],
      contacts: [graph.contact_id],
    };
    const proof = await captureMaDirectoryProof(db, owned);
    assert.equal((await verifyMaDirectoryProof(db, proof)).persistedRecords, 4);
    const ownedFile = join(artifacts, "owned.json"),
      manifestFile = join(artifacts, "manifest.json");
    writeFileSync(ownedFile, JSON.stringify(owned), { mode: 0o600 });
    assert.equal(command("inspect").readOnly, true);
    command("capture", "--run-id", runId, "--manifest-file", manifestFile);
    assert.equal(JSON.parse(readFileSync(manifestFile, "utf8")).rows.length, 4);
    assert.equal(
      command("verify", "--manifest-file", manifestFile).persistedRecords,
      4,
    );

    await db.query("CREATE ROLE fixture_ma_readonly NOLOGIN");
    await db.query("SET ROLE fixture_ma_readonly");
    try {
      await assert.rejects(
        cleanupMaDirectoryProof(db, proof, { commit: true }),
        /M&A cleanup requires a role that can observe all references/,
      );
    } finally {
      await db.query("RESET ROLE");
    }
    await db.query("DROP ROLE fixture_ma_readonly");

    // A new cascading relation deliberately models a future history table. The
    // cleanup must discover it from the actual catalog, not a hardcoded FK list.
    await db.query(
      "CREATE TABLE public.fixture_external_ma_history(id uuid PRIMARY KEY, office_id uuid REFERENCES public.ma_offices(id) ON DELETE CASCADE)",
    );
    await db.query(
      "INSERT INTO public.fixture_external_ma_history VALUES ($1,$2)",
      [randomUUID(), graph.office_id],
    );
    await assert.rejects(
      cleanupMaDirectoryProof(db, proof, { commit: true }),
      /External M&A reference blocks cleanup/,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM public.ma_offices WHERE id=$1",
          [graph.office_id],
        )
      ).rows[0].count,
      1,
    );
    await db.query("DROP TABLE public.fixture_external_ma_history");

    assert.equal((await cleanupMaDirectoryProof(db, proof)).committed, false);
    assert.equal((await verifyMaDirectoryProof(db, proof)).persistedRecords, 4);
    assert.equal(
      command("preflight", "--manifest-file", manifestFile).committed,
      false,
    );
    await db.query("UPDATE public.ma_offices SET city='Paris' WHERE id=$1", [
      graph.office_id,
    ]);
    await assert.rejects(
      cleanupMaDirectoryProof(db, proof, { commit: true }),
      /Owned M&A records changed after capture/,
    );
    const correctedFile = join(artifacts, "corrected.json");
    command(
      "capture",
      "--owned-file",
      ownedFile,
      "--manifest-file",
      correctedFile,
    );
    assert.equal(
      command("cleanup", "--manifest-file", correctedFile).remaining,
      0,
    );
    assert.equal(
      command("verify-cleanup", "--manifest-file", correctedFile).remaining,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM public.ma_firms WHERE id=$1",
          [graph.firm_id],
        )
      ).rows[0].count,
      0,
    );
    console.log(
      "M&A proof: readback, external cascade veto, drift veto, rollback preflight and zero-residue cleanup passed.",
    );
  } finally {
    await db.end();
    rmSync(artifacts, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(
    "Disposable M&A tooling rehearsal failed:",
    error instanceof Error ? error.message : "unknown failure",
  );
  process.exitCode = 1;
});
