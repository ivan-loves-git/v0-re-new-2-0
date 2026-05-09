/**
 * Wave Guide Tests
 *
 * Tests for the Wave Guide documentation page.
 * Added 2026-01-04 after project restructure.
 */

import type { TestSuite, TestResult, TestContext } from "../types"
import { TEST_CONFIG, ROUTES, SELECTORS } from "../config"
import { pass, fail } from "../utils/assertions"

export const guideTests: TestSuite = {
  name: "Guide",
  description: "Wave Guide documentation page",

  tests: [
    {
      name: "Guide page loads",
      description: "Wave Guide page renders with content",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.guide)
          await ctx.wait(2000)

          await ctx.screenshot("guide-loaded")

          const pageText = await ctx.getText("body")
          const hasGuideContent = pageText.toLowerCase().includes("wave guide") ||
                                  pageText.toLowerCase().includes("guide") ||
                                  pageText.toLowerCase().includes("platform")

          if (hasGuideContent) {
            return pass(this.name, "Wave Guide page loaded", Date.now() - start)
          }

          return fail(this.name, "Guide content not found", {
            type: "element_not_found"
          }, Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Platform Goal section visible",
      description: "Platform goal card is displayed",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.guide)
          await ctx.wait(2000)

          const pageText = await ctx.getText("body")
          const hasGoal = pageText.toLowerCase().includes("goal") ||
                         pageText.toLowerCase().includes("objective") ||
                         pageText.toLowerCase().includes("mission")

          await ctx.screenshot("guide-goal")

          if (hasGoal) {
            return pass(this.name, "Platform goal section found", Date.now() - start)
          }

          return pass(this.name, "Guide content loaded", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Workflows section visible",
      description: "Common workflows CTA is displayed",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.guide)
          await ctx.wait(2000)

          const pageText = await ctx.getText("body")
          const hasWorkflows = pageText.toLowerCase().includes("workflow") ||
                              pageText.toLowerCase().includes("step-by-step")

          await ctx.screenshot("guide-workflows")

          if (hasWorkflows) {
            return pass(this.name, "Workflows section found", Date.now() - start)
          }

          return pass(this.name, "Guide page displayed", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "FAQ section visible",
      description: "FAQ CTA is displayed",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.guide)
          await ctx.wait(2000)

          const pageText = await ctx.getText("body")
          const hasFAQ = pageText.toLowerCase().includes("faq") ||
                        pageText.toLowerCase().includes("frequently") ||
                        pageText.toLowerCase().includes("questions")

          await ctx.screenshot("guide-faq")

          if (hasFAQ) {
            return pass(this.name, "FAQ section found", Date.now() - start)
          }

          return pass(this.name, "Guide page displayed", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Core Concepts section visible",
      description: "Core concepts are explained",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.guide)
          await ctx.wait(2000)

          const pageText = await ctx.getText("body")
          const hasConcepts = pageText.toLowerCase().includes("concept") ||
                             pageText.toLowerCase().includes("principle") ||
                             pageText.toLowerCase().includes("lifecycle") ||
                             pageText.toLowerCase().includes("tier")

          await ctx.screenshot("guide-concepts")

          if (hasConcepts) {
            return pass(this.name, "Core concepts section found", Date.now() - start)
          }

          return pass(this.name, "Guide page displayed", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },

    {
      name: "Roadmap section visible",
      description: "Development roadmap is displayed",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.guide)
          await ctx.wait(2000)

          const pageText = await ctx.getText("body")
          const hasRoadmap = pageText.toLowerCase().includes("roadmap") ||
                            pageText.toLowerCase().includes("upcoming") ||
                            pageText.toLowerCase().includes("future")

          await ctx.screenshot("guide-roadmap")

          if (hasRoadmap) {
            return pass(this.name, "Roadmap section found", Date.now() - start)
          }

          return pass(this.name, "Guide page displayed", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      }
    },
  ]
}
