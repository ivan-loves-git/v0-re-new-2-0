#!/usr/bin/env node

/**
 * A deliberately small TLS terminator for runner-hosted QA.  It only accepts
 * traffic on localhost and only forwards to a localhost HTTP application.
 * It is not a general-purpose proxy and must never be exposed outside a CI
 * runner.
 */
import http from "node:http"
import https from "node:https"
import { readFile } from "node:fs/promises"

const LOOPBACK_HOST = "127.0.0.1"
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

function fail(code) {
  throw new Error(`Loopback HTTPS proxy configuration failed: ${code}`)
}

function loopbackHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost"
}

function localPort(value, code) {
  if (!/^\d+$/.test(value || "")) fail(code)
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail(code)
  return port
}

/** Reads only explicit configuration; values are never written to stdout. */
export function readLoopbackProxyConfig(env = process.env) {
  const targetValue = env.QA_LOOPBACK_PROXY_TARGET
  const certificateFile = env.QA_LOOPBACK_PROXY_CERT_FILE
  const keyFile = env.QA_LOOPBACK_PROXY_KEY_FILE
  const bindHost = env.QA_LOOPBACK_PROXY_BIND || LOOPBACK_HOST
  const port = localPort(env.QA_LOOPBACK_PROXY_PORT, "port")
  if (!certificateFile) fail("certificate-file")
  if (!keyFile) fail("key-file")
  if (bindHost !== LOOPBACK_HOST) fail("bind")

  let target
  try {
    target = new URL(targetValue)
  } catch {
    fail("target")
  }
  if (target.protocol !== "http:" || !loopbackHostname(target.hostname) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
    fail("target")
  }
  if (!target.port) fail("target")
  localPort(target.port, "target")

  return {
    bindHost,
    certificateFile,
    keyFile,
    port,
    target,
  }
}

/** Preserve normal request headers while making the trust boundary explicit. */
export function forwardedHeaders(headers, { bindHost, port, target }) {
  const result = {}
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (lower === "host" || lower === "x-forwarded-for" || lower === "x-forwarded-host" || lower === "x-forwarded-proto" || HOP_BY_HOP_HEADERS.has(lower)) continue
    if (value !== undefined) result[name] = value
  }
  result.host = target.host
  result["x-forwarded-proto"] = "https"
  result["x-forwarded-host"] = `${bindHost}:${port}`
  result["x-forwarded-for"] = bindHost
  return result
}

export async function startLoopbackHttpsProxy({ env = process.env, onError = () => {} } = {}) {
  const config = readLoopbackProxyConfig(env)
  const [cert, key] = await Promise.all([readFile(config.certificateFile), readFile(config.keyFile)])
  const server = https.createServer({ cert, key }, (request, response) => {
    const upstream = http.request({
      hostname: config.target.hostname,
      port: Number(config.target.port),
      method: request.method,
      path: request.url || "/",
      headers: forwardedHeaders(request.headers, config),
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
      upstreamResponse.pipe(response)
    })
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502)
      response.end("QA loopback proxy upstream unavailable")
    })
    request.pipe(upstream)
  })
  server.on("error", onError)
  await new Promise((resolve, reject) => {
    const rejectOnce = (error) => {
      server.off("listening", resolve)
      reject(error)
    }
    server.once("error", rejectOnce)
    server.once("listening", () => {
      server.off("error", rejectOnce)
      resolve()
    })
    server.listen(config.port, config.bindHost)
  })
  return server
}

export async function stopLoopbackHttpsProxy(server) {
  if (!server?.listening) return
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

async function main() {
  const server = await startLoopbackHttpsProxy({ onError: () => process.exitCode = 1 })
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    stopLoopbackHttpsProxy(server).finally(() => process.exit())
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch(() => {
    process.exitCode = 1
  })
}
