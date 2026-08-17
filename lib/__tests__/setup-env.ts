const testEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  DATABASE_URL: "postgresql://test:test@localhost:5432/renew_test",
  BETTER_AUTH_SECRET: "test-only-auth-secret-that-is-long-enough",
  BETTER_AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  RESEND_FROM_EMAIL: "noreply@test.invalid",
  CRON_SECRET: "test-cron-secret",
} as const

Object.assign(process.env, testEnvironment)
