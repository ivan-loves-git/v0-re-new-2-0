import { describe, expect, it } from "vitest"
import { trustedAuthOrigins } from "@/lib/auth-origin-policy"

describe("W-151 trusted authentication origins", () => {
  it("trusts only exact Re-New and deployment-configured origins", () => {
    const origins = trustedAuthOrigins({
      betterAuthUrl: "https://app.re-new.team",
      nodeEnv: "production",
      vercelUrl: "v0-re-new-2-0-git-w151-myworkmail4-pngs-projects.vercel.app",
      vercelBranchUrl: "v0-re-new-2-0-git-w151.vercel.app",
      vercelProjectProductionUrl: "v0-re-new-2-0.vercel.app",
    })

    expect(new Set(origins)).toEqual(
      new Set([
        "https://app.re-new.team",
        "https://v0-re-new-2-0-git-w151-myworkmail4-pngs-projects.vercel.app",
        "https://v0-re-new-2-0-git-w151.vercel.app",
        "https://v0-re-new-2-0.vercel.app",
      ]),
    )
    expect(origins).not.toContain("https://attacker.vercel.app")
    expect(origins).not.toContain("https://preview.v0.dev")
    expect(origins).not.toContain("https://preview.v0.app")
  })

  it.each([
    { betterAuthUrl: "https://attacker.vercel.app" },
    { betterAuthUrl: "https://app.re-new.team.attacker.example" },
    { betterAuthUrl: "http://app.re-new.team" },
    { betterAuthUrl: "https://user:secret@app.re-new.team" },
    { betterAuthUrl: "https://app.re-new.team/auth" },
    { betterAuthUrl: "https://app.re-new.team?next=/auth" },
    { betterAuthUrl: "https://app.re-new.team#auth" },
    { betterAuthUrl: "ftp://app.re-new.team" },
    { betterAuthUrl: "http://localhost:3000" },
    { betterAuthUrl: "https://*.re-new.team" },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "attacker.vercel.app.evil.example",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "https://user@owned.vercel.app",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "https://owned.vercel.app/path",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "http://owned.vercel.app",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "vercel.app",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "*.vercel.app",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelUrl: "preview.re-new.team",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelProjectProductionUrl: "attacker.example",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      vercelProjectProductionUrl: "*.re-new.team",
    },
    {
      betterAuthUrl: "https://app.re-new.team",
      betterAuthTrustedOrigins: "https://*.vercel.app",
    },
  ])("rejects an origin configuration that can broaden trust: %#", (input) => {
    expect(() =>
      trustedAuthOrigins({
        nodeEnv: "production",
        ...input,
      }),
    ).toThrow("Auth origin rejected")
  })

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("preserves exact loopback development at %s", (betterAuthUrl) => {
    expect(
      trustedAuthOrigins({
        betterAuthUrl,
        nodeEnv: "development",
      }),
    ).toContain(new URL(betterAuthUrl).origin)
  })

  it("accepts the exact Re-New custom domain Vercel reports for production", () => {
    expect(
      trustedAuthOrigins({
        betterAuthUrl: "https://app.re-new.team",
        nodeEnv: "production",
        vercelProjectProductionUrl: "app.re-new.team",
      }),
    ).toEqual(["https://app.re-new.team"])
  })
})
