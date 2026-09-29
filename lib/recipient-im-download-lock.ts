import "server-only"

import { Pool } from "pg"
import { env } from "@/lib/env"
import { postgresSslForConnection } from "@/lib/postgres-ssl"

let pool: Pool | null = null

function recipientImPool() {
  return pool ??= new Pool({
    connectionString: env.DATABASE_URL,
    ssl: postgresSslForConnection(env.DATABASE_URL),
    max: 2,
    idleTimeoutMillis: 10_000,
  })
}

/** Keep the pursuit's row locked until recipient bytes are fully buffered and
 * live access has been checked again. Canonical Drop takes FOR UPDATE on that
 * same row; it cannot commit while this route is still preparing a response. */
export async function withRecipientImPursuitLock<T>(matchId: string, work: () => Promise<T>): Promise<T> {
  const client = await recipientImPool().connect()
  let inTransaction = false
  try {
    await client.query("BEGIN")
    inTransaction = true
    await client.query("SET LOCAL lock_timeout = '15s'")
    const { rows } = await client.query("SELECT id FROM public.opportunity_matches WHERE id=$1 FOR SHARE", [matchId])
    if (rows.length !== 1) throw new Error("Recipient pursuit is unavailable.")
    const result = await work()
    await client.query("COMMIT")
    inTransaction = false
    return result
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
