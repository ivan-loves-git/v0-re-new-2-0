import { describe, expect, it } from "vitest";
import { postgresSslForConnection } from "@/lib/postgres-ssl";

describe("protected fixture PostgreSQL transport", () => {
  it("keeps Supabase SSL outside the disposable fixture", () => {
    expect(
      postgresSslForConnection("postgresql://production.example/postgres", {}),
    ).toEqual({ rejectUnauthorized: false });
  });

  it("disables SSL only for the exact GitHub-hosted loopback fixture", () => {
    expect(
      postgresSslForConnection(
        "postgresql://postgres:fixture@127.0.0.1:54322/postgres",
        {
          CI: "true",
          GITHUB_ACTIONS: "true",
          QA_CONTRACT_MODE: "protected",
          QA_FIXTURE_MODE: "local",
        },
      ),
    ).toBe(false);
  });

  it.each([{}, { CI: "true" }, { CI: "true", GITHUB_ACTIONS: "true" }])(
    "rejects partial fixture authority %#",
    (runtime) => {
      expect(() =>
        postgresSslForConnection(
          "postgresql://postgres:fixture@127.0.0.1:54322/postgres",
          { QA_FIXTURE_MODE: "local", ...runtime },
        ),
      ).toThrow("restricted to the protected disposable fixture");
    },
  );

  it.each([
    "postgresql://postgres:fixture@database.example:54322/postgres",
    "postgresql://postgres:fixture@127.0.0.1:5432/postgres",
    "postgresql://postgres:fixture@127.0.0.1:54322/other",
  ])("rejects a non-fixture database at %s", (connectionString) => {
    expect(() =>
      postgresSslForConnection(connectionString, {
        CI: "true",
        GITHUB_ACTIONS: "true",
        QA_CONTRACT_MODE: "protected",
        QA_FIXTURE_MODE: "local",
      }),
    ).toThrow("exact disposable loopback database");
  });
});
