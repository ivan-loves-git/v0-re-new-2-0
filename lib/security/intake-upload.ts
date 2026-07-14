import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { Pool } from "pg"
import { env } from "@/lib/env"

const TOKEN_TTL_SECONDS = 15 * 60
const TOKEN_ISSUE_LIMIT = 6
const UPLOADS_PER_IP_PER_HOUR = 6

interface IntakeUploadPayload {
  exp: number
  ip: string
  jti: string
  scope: "intake-upload"
}

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return pool
}

function requestIp(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  return forwarded.split(",")[0]?.trim() || "unknown"
}

export function requestFingerprint(request: Request) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(requestIp(request))
    .digest("base64url")
}

function sign(value: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(value)
    .digest("base64url")
}

export async function consumeRequestRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
) {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const { rows } = await getPool().query<{
    count: number
    lastRequest: string
  }>(
    `INSERT INTO public."rateLimit" (key, count, "lastRequest")
     VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE
         WHEN $2 - "rateLimit"."lastRequest" >= $3 THEN 1
         ELSE "rateLimit".count + 1
       END,
       "lastRequest" = CASE
         WHEN $2 - "rateLimit"."lastRequest" >= $3 THEN $2
         ELSE "rateLimit"."lastRequest"
       END
     RETURNING count, "lastRequest"`,
    [key, now, windowMs],
  )

  const count = Number(rows[0]?.count ?? max + 1)
  const windowStart = Number(rows[0]?.lastRequest ?? now)
  return {
    allowed: count <= max,
    retryAfter: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
  }
}

export class IntakeUploadSecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

export async function issueIntakeUploadToken(request: Request) {
  const fingerprint = requestFingerprint(request)
  const issueLimit = await consumeRequestRateLimit(
    `intake-token:${fingerprint}`,
    TOKEN_ISSUE_LIMIT,
    60 * 60,
  )
  if (!issueLimit.allowed) {
    throw new IntakeUploadSecurityError(
      "Too many upload requests. Please try again later.",
      429,
      issueLimit.retryAfter,
    )
  }

  const payload: IntakeUploadPayload = {
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    ip: fingerprint,
    jti: randomBytes(18).toString("base64url"),
    scope: "intake-upload",
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encoded}.${sign(encoded)}`
}

export async function verifyAndConsumeIntakeUploadToken(
  request: Request,
  token: string | null,
) {
  if (!token) {
    throw new IntakeUploadSecurityError(
      "Upload authorization is required.",
      401,
    )
  }

  const parts = token.split(".")
  if (parts.length !== 2) {
    throw new IntakeUploadSecurityError("Invalid upload authorization.", 401)
  }

  const [encoded, providedSignature] = parts
  const expectedSignature = sign(encoded)
  const actualBuffer = Buffer.from(providedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new IntakeUploadSecurityError("Invalid upload authorization.", 401)
  }

  let payload: IntakeUploadPayload
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as IntakeUploadPayload
  } catch {
    throw new IntakeUploadSecurityError("Invalid upload authorization.", 401)
  }

  if (
    payload.scope !== "intake-upload" ||
    !payload.jti ||
    payload.exp < Math.floor(Date.now() / 1000) ||
    payload.ip !== requestFingerprint(request)
  ) {
    throw new IntakeUploadSecurityError(
      "Upload authorization has expired or is invalid.",
      401,
    )
  }

  const tokenLimit = await consumeRequestRateLimit(
    `intake-upload-token:${payload.jti}`,
    1,
    TOKEN_TTL_SECONDS,
  )
  if (!tokenLimit.allowed) {
    throw new IntakeUploadSecurityError(
      "Upload authorization has already been used.",
      429,
      tokenLimit.retryAfter,
    )
  }

  const ipLimit = await consumeRequestRateLimit(
    `intake-upload-ip:${payload.ip}`,
    UPLOADS_PER_IP_PER_HOUR,
    60 * 60,
  )
  if (!ipLimit.allowed) {
    throw new IntakeUploadSecurityError(
      "Upload quota reached. Please try again later.",
      429,
      ipLimit.retryAfter,
    )
  }

  return { id: payload.jti }
}
