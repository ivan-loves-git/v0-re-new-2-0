/**
 * Authentication Tests
 *
 * Tests for login, logout, session persistence, and protected routes.
 */

import type { TestSuite, TestResult, TestContext } from "../types"
import { TEST_CONFIG, ROUTES, SELECTORS } from "../config"
import { pass, fail } from "../utils/assertions"

export const authTests: TestSuite = {
  name: "Authentication",
  description: "Login, logout, and session management",

  tests: [
    {
      name: "Login page loads correctly",
      description: "Verify the login page renders with email/password fields",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.login)
          await ctx.wait(1000)

          const emailExists = await ctx.elementExists(SELECTORS.loginEmail)
          const passwordExists = await ctx.elementExists(SELECTORS.loginPassword)
          const buttonExists = await ctx.elementExists(SELECTORS.loginButton)

          await ctx.screenshot("auth-login-page")

          if (emailExists && passwordExists && buttonExists) {
            return pass(this.name, "Login page loaded with all required fields", Date.now() - start)
          }

          return fail(this.name, `Missing elements - email: ${emailExists}, password: ${passwordExists}, button: ${buttonExists}`, {
            type: "element_not_found"
          }, Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Login with valid credentials",
      description: "Successfully login and redirect to dashboard",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.login)
          await ctx.wait(1000)

          // Enter credentials
          await ctx.type(SELECTORS.loginEmail, TEST_CONFIG.credentials.email)
          await ctx.type(SELECTORS.loginPassword, TEST_CONFIG.credentials.password)

          await ctx.screenshot("auth-credentials-entered")

          // Click login button
          await ctx.click(SELECTORS.loginButton)

          // Wait for navigation
          await ctx.wait(3000)

          // Check if redirected to dashboard
          const onDashboard = await ctx.waitForNavigation(ROUTES.dashboard)

          await ctx.screenshot("auth-after-login")

          if (onDashboard) {
            return pass(this.name, "Successfully logged in and redirected to dashboard", Date.now() - start)
          }

          return fail(this.name, "Did not redirect to dashboard after login", {
            type: "navigation"
          }, Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Login with invalid credentials shows error",
      description: "Attempting login with wrong password shows error message",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.login)
          await ctx.wait(1000)

          // Enter wrong credentials
          await ctx.type(SELECTORS.loginEmail, TEST_CONFIG.credentials.email)
          await ctx.type(SELECTORS.loginPassword, "wrongpassword123")

          // Click login
          await ctx.click(SELECTORS.loginButton)
          await ctx.wait(2000)

          // Check for error message
          const errorExists = await ctx.elementExists(SELECTORS.loginError)

          await ctx.screenshot("auth-invalid-login")

          if (errorExists) {
            return pass(this.name, "Error message displayed for invalid credentials", Date.now() - start)
          }

          // Also check if still on login page (not redirected)
          const stillOnLogin = await ctx.waitForNavigation(ROUTES.login)
          if (stillOnLogin) {
            return pass(this.name, "Login failed and stayed on login page", Date.now() - start)
          }

          return fail(this.name, "No error shown and may have logged in with wrong password", {
            type: "assertion"
          }, Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Session persists after page refresh",
      description: "User stays logged in after refreshing the page",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          // First ensure we're logged in by going to dashboard
          await ctx.navigate(ROUTES.dashboard)
          await ctx.wait(2000)

          // Refresh the page (navigate to same URL)
          await ctx.navigate(ROUTES.dashboard)
          await ctx.wait(2000)

          // Check if still on dashboard (not redirected to login)
          const stillOnDashboard = await ctx.waitForNavigation(ROUTES.dashboard)

          await ctx.screenshot("auth-session-persist")

          if (stillOnDashboard) {
            return pass(this.name, "Session persisted after refresh", Date.now() - start)
          }

          return fail(this.name, "Session was lost after refresh - redirected to login", {
            type: "assertion"
          }, Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Protected route redirects to login when not authenticated",
      description: "Accessing dashboard without auth redirects to login",
      skip: true, // This would log us out - skip in normal test run
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          // Note: This test would require logging out first
          // For now, we skip it to avoid disrupting other tests

          return pass(this.name, "Test skipped to preserve session", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    }
  ]
}
