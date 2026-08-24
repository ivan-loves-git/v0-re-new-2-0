import { describe, expect, it } from "vitest"

import { forwardedHeaders, readLoopbackProxyConfig } from "../../scripts/qa/loopback-https-proxy.mjs"

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  QA_LOOPBACK_PROXY_CERT_FILE: ".qa-run/loopback.crt",
  QA_LOOPBACK_PROXY_KEY_FILE: ".qa-run/loopback.key",
  QA_LOOPBACK_PROXY_PORT: "8443",
  QA_LOOPBACK_PROXY_TARGET: "http://127.0.0.1:3000",
}

describe("runner QA loopback HTTPS proxy", () => {
  it("accepts only an explicit localhost HTTP target and binds TLS to IPv4 loopback", () => {
    const config = readLoopbackProxyConfig(validEnv)

    expect(config.bindHost).toBe("127.0.0.1")
    expect(config.port).toBe(8443)
    expect(config.target?.href).toBe("http://127.0.0.1:3000/")
  })

  it("rejects every non-IPv4-loopback bind address", () => {
    expect(() => readLoopbackProxyConfig({ ...validEnv, QA_LOOPBACK_PROXY_BIND: "0.0.0.0" })).toThrow("bind")
    expect(() => readLoopbackProxyConfig({ ...validEnv, QA_LOOPBACK_PROXY_BIND: "::1" })).toThrow("bind")
  })

  it.each([
    "https://127.0.0.1:3000",
    "http://example.test:3000",
    "http://10.0.0.1:3000",
    "http://127.0.0.1:3000/app",
    "http://127.0.0.1:3000?redirect=https://example.test",
  ])("rejects an unsafe target: %s", (target) => {
    expect(() => readLoopbackProxyConfig({ ...validEnv, QA_LOOPBACK_PROXY_TARGET: target })).toThrow("target")
  })

  it("preserves ordinary headers while replacing forwarded and host headers at the local trust boundary", () => {
    const config = readLoopbackProxyConfig(validEnv)
    expect(forwardedHeaders({
      accept: "application/json",
      authorization: "Bearer browser-token",
      connection: "keep-alive",
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "http",
    }, config)).toEqual({
      accept: "application/json",
      authorization: "Bearer browser-token",
      host: "127.0.0.1:3000",
      "x-forwarded-for": "127.0.0.1",
      "x-forwarded-host": "127.0.0.1:8443",
      "x-forwarded-proto": "https",
    })
  })
})
