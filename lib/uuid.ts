/**
 * Route parameters for persisted business records are UUIDs. Validate them at
 * the route/action boundary so malformed URLs produce a normal not-found
 * outcome instead of a database cast error.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
