import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { afterEach, describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  ".github/workflows/opening-readiness-fixture.yml",
);
const assemblerPath = resolve(
  process.cwd(),
  "scripts/assemble-opening-readiness-artifact.sh",
);
const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "renew-artifact-policy-"));
  temporaryDirectories.push(directory);
  return directory;
}

function hasForbiddenArtifactField(value: unknown): boolean {
  const forbidden =
    /email|name|password|hash|credential|token|user|(?:^|_)id$|url|request|response|trace|context|mail|provider/i;
  if (Array.isArray(value)) return value.some(hasForbiddenArtifactField);
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) =>
        forbidden.test(key) || hasForbiddenArtifactField(nested),
    );
  }
  return typeof value === "string" && forbidden.test(value);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("opening-readiness artifact policy", () => {
  it("uploads exactly one aggregate file and never a diagnostic directory", async () => {
    const workflow = parse(await readFile(workflowPath, "utf8")) as {
      jobs: { fixture: { steps: Array<Record<string, unknown>> } };
    };
    const steps = workflow.jobs.fixture.steps;
    const uploads = steps.filter(
      (step) =>
        step.uses ===
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    );
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.with).toMatchObject({
      path: "${{ runner.temp }}/opening-readiness-published/aggregate-summary.json",
    });
    expect(JSON.stringify(uploads)).not.toMatch(
      /opening-readiness-evidence|opening-readiness-playwright|\.jsonl/i,
    );
    expect(steps).toContainEqual(
      expect.objectContaining({
        name: "Assemble aggregate-safe evidence",
        run: "bash scripts/assemble-opening-readiness-artifact.sh",
      }),
    );
  });

  it("projects only aggregate-safe fields from adversarial working evidence", async () => {
    const root = await temporaryDirectory();
    const published = join(root, "published");
    await writeFile(
      join(root, "portal-access-uat.json"),
      JSON.stringify({
        freshEnable: {
          cancelNoOp: true,
          confirmedDeliveries: 1,
          oneNewRole: true,
          activeSessions: 0,
        },
        resend: {
          cancelNoOp: true,
          confirmedDeliveries: 1,
          activeSessionsRetained: true,
          observedUnusedResetRecordsAfterOneResend: 2,
        },
        staleConfirmation: { rejected: true, extraDeliveries: 0 },
        disable: {
          cancelNoOp: true,
          roleRemoved: true,
          activeSessionsRevoked: true,
          unusedResetLinksRevoked: true,
        },
        repair: {
          cancelNoOp: true,
          confirmedDeliveries: 1,
          oneRole: true,
          priorSessionsRevoked: true,
        },
        setup: {
          validLinkConsumedOnce: true,
          replayRejected: true,
          consumedBrowserRecovery: true,
        },
        recovery: {
          expiredRejected: true,
          malformedRejected: true,
          missingRejected: true,
          missingRefreshAndBackForwardSafe: true,
          disableRevokedRejected: true,
        },
        nonStaff: { staffRouteDenied: true, staffActionUiAbsent: true },
        email: "qa-opening@example.invalid",
        passwordHash: "must-not-retain",
        credentialReadback: "must-not-retain",
        token: "must-not-retain",
        userId: "must-not-retain",
        databaseId: "must-not-retain",
        url: "https://example.invalid/?token=must-not-retain",
        request: { body: "must-not-retain" },
        response: { body: "must-not-retain" },
        trace: "must-not-retain",
        context: "must-not-retain",
        rawMail: "must-not-retain",
        provider: "must-not-retain",
      }),
    );
    await writeFile(
      join(root, "teardown.json"),
      JSON.stringify({
        cleanupBoundary: "whole disposable stack",
        stackDestroySucceeded: true,
        residue: {
          containers: 0,
          volumes: 0,
          networks: 0,
          databaseReachable: false,
        },
        databaseId: "must-not-retain",
      }),
    );
    await writeFile(join(root, "raw.jsonl"), '{"email":"must-not-retain"}\n');

    execFileSync("bash", [assemblerPath], {
      env: {
        ...process.env,
        OPENING_READINESS_EVIDENCE_DIR: root,
        OPENING_READINESS_PUBLISHED_DIR: published,
        OPENING_FIXTURE_RELEASE_SHA: "candidate-sha",
      },
    });

    const artifact = JSON.parse(
      await readFile(join(published, "aggregate-summary.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(artifact).toMatchObject({
      releaseSha: "candidate-sha",
      artifactPolicy: "aggregate-safe allowlist only",
      accessUat: {
        enabled: { confirmedDeliveries: 1 },
        recovery: { consumedBrowserRecovery: true },
      },
      teardown: { stackDestroySucceeded: true },
    });
    expect(hasForbiddenArtifactField(artifact)).toBe(false);
    expect(await readdir(published)).toEqual(["aggregate-summary.json"]);
  });
});
