import { describe, expect, it } from "vitest";
import {
  OPENING_READINESS_FIXTURE,
  assertOpeningReadinessFixtureEnvironment,
  fixtureReadbackIsHealthy,
  fixtureResidueIsZero,
  openingReadinessRunLabel,
} from "@/lib/opening-readiness-fixture";

const protectedEnvironment = {
  CI: "true",
  GITHUB_ACTIONS: "true",
  QA_FIXTURE_MODE: "local",
  QA_CONTRACT_MODE: "protected",
  QA_MAIL_MODE: "allowlist",
  QA_EMAIL_RECIPIENT: OPENING_READINESS_FIXTURE.mailRecipients.join(","),
  OPENING_FIXTURE_DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
};

describe("opening readiness fixture operator", () => {
  it("uses fixed synthetic identities and a SHA-bound run label", () => {
    expect(OPENING_READINESS_FIXTURE.repreneurs.real.email).toMatch(
      /\.(test|invalid)$/,
    );
    expect(OPENING_READINESS_FIXTURE.repreneurs.demo.email).toMatch(
      /\.(test|invalid)$/,
    );
    expect(OPENING_READINESS_FIXTURE.staff.email).toMatch(/\.(test|invalid)$/);
    expect(OPENING_READINESS_FIXTURE.opportunities.real.reference).toContain(
      "QA-OPENING",
    );
    expect(
      openingReadinessRunLabel("199f28ea79f2c773e3e86369987ad1785ca26c9b"),
    ).toBe("qa-opening-199f28ea");
  });

  it("accepts only a protected GitHub runner and loopback Supabase stack", () => {
    const target =
      assertOpeningReadinessFixtureEnvironment(protectedEnvironment);
    expect(target.databaseUrl.hostname).toBe("127.0.0.1");
    expect(target.apiUrl.hostname).toBe("127.0.0.1");

    expect(() =>
      assertOpeningReadinessFixtureEnvironment({
        ...protectedEnvironment,
        GITHUB_ACTIONS: "false",
      }),
    ).toThrow(/GitHub Actions/i);
    expect(() =>
      assertOpeningReadinessFixtureEnvironment({
        ...protectedEnvironment,
        OPENING_FIXTURE_DATABASE_URL:
          "postgresql://postgres:postgres@db.example.com:5432/postgres",
      }),
    ).toThrow(/loopback/i);
    expect(() =>
      assertOpeningReadinessFixtureEnvironment({
        ...protectedEnvironment,
        RESEND_API_KEY: "must-not-be-present",
      }),
    ).toThrow(/email/i);
    expect(() =>
      assertOpeningReadinessFixtureEnvironment({
        ...protectedEnvironment,
        QA_EMAIL_RECIPIENT: "qa-opening-real@re-new.invalid",
      }),
    ).toThrow(/allowlist/i);
  });

  it("requires the staged identities and no cross-namespace relationship", () => {
    const healthy = {
      staffUser: 1,
      staffRole: 1,
      realRepreneur: 1,
      realAuthUser: 1,
      realPortalRole: 1,
      demoRepreneur: 1,
      demoAuthUser: 1,
      demoPortalRole: 1,
      realOpportunity: 1,
      demoOpportunity: 1,
      crossNamespaceMatch: 0,
    };
    expect(fixtureReadbackIsHealthy(healthy)).toBe(true);
    expect(
      fixtureReadbackIsHealthy({ ...healthy, crossNamespaceMatch: 1 }),
    ).toBe(false);
  });

  it("accepts cleanup only when every fixture surface has zero residue", () => {
    const empty = {
      users: 0,
      accounts: 0,
      sessions: 0,
      verifications: 0,
      roles: 0,
      repreneurs: 0,
      opportunities: 0,
      matches: 0,
      offices: 0,
      contacts: 0,
      documents: 0,
      storageObjects: 0,
    };
    expect(fixtureResidueIsZero(empty)).toBe(true);
    expect(fixtureResidueIsZero({ ...empty, sessions: 1 })).toBe(false);
  });
});
