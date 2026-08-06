import { describe, expect, it } from "vitest"
import type { CaptureResult, CapturedNetworkRequest } from "posthog-js"
import {
  createBeforeSend,
  isDeniedDiagnosticUrl,
  maskCapturedNetworkRequest,
  maskReplayAttribute,
  normalizeRouteTemplate,
  normalizeUrl,
  sanitizeDiagnosticText,
  surfaceForRoute,
  workflowForRoute,
} from "@/lib/telemetry/privacy"

const context = {
  environment: "production" as const,
  release: "1200.abc1234",
  isTest: false,
}

describe("WAVE telemetry privacy", () => {
  it("normalizes dynamic routes without retaining identifiers or query strings", () => {
    expect(
      normalizeRouteTemplate(
        "/repreneurs/019fd674-9442-7000-a255-fa06c75772d7/questionnaire?email=person@example.com",
      ),
    ).toBe("/repreneurs/:id/questionnaire")
    expect(normalizeRouteTemplate("/assessment/private-token/success#result")).toBe(
      "/assessment/:token/success",
    )
    expect(normalizeRouteTemplate("/future/customer-secret")).toBe("/:id/:id")
  })

  it("classifies the four product surfaces from normalized routes", () => {
    expect(surfaceForRoute("/intake-v2")).toBe("public")
    expect(surfaceForRoute("/auth/login")).toBe("auth")
    expect(surfaceForRoute("/dashboard_re")).toBe("staff")
    expect(surfaceForRoute("/portal/deals/:matchId")).toBe("repreneur")
  })

  it("maps route templates to metadata-only product workflows", () => {
    expect(workflowForRoute("/auth/login")).toBe("authentication")
    expect(workflowForRoute("/intake-v2")).toBe("intake")
    expect(workflowForRoute("/repreneurs/private/questionnaire")).toBe("assessment")
    expect(workflowForRoute("/opportunities/private")).toBe("opportunity_management")
    expect(workflowForRoute("/portal/deals/private")).toBe("portal_deals")
    expect(workflowForRoute("/tools/wave-ai")).toBe("wave_ai")
    expect(workflowForRoute("/future/private")).toBe("navigation")
  })

  it("removes URL identifiers, queries, and fragments", () => {
    expect(
      normalizeUrl(
        "https://app.re-new.team/portal/deals/019fd674-9442-7000-a255-fa06c75772d7?email=person@example.com#memo",
      ),
    ).toBe("https://app.re-new.team/portal/deals/:matchId")
  })

  it("drops AI network diagnostics and strips all other payloads", () => {
    expect(isDeniedDiagnosticUrl("/api/wave-ai/generate")).toBe(true)
    expect(isDeniedDiagnosticUrl("/api/wavy/send")).toBe(true)

    const request = {
      name: "https://app.re-new.team/api/repreneurs/019fd674-9442-7000-a255-fa06c75772d7?token=secret",
      entryType: "resource",
      startTime: 1,
      duration: 10,
      requestHeaders: { authorization: "Bearer secret" },
      requestBody: "person@example.com",
      responseHeaders: { "set-cookie": "secret" },
      responseBody: "private record",
    } as CapturedNetworkRequest

    expect(maskCapturedNetworkRequest(request)).toMatchObject({
      name: "https://app.re-new.team/api/repreneurs/:id",
      requestHeaders: undefined,
      requestBody: undefined,
      responseHeaders: undefined,
      responseBody: undefined,
    })
    expect(
      maskCapturedNetworkRequest({
        ...request,
        name: "https://app.re-new.team/api/wave-ai/generate",
      }),
    ).toBeNull()
  })

  it("masks content-bearing replay attributes while retaining layout attributes", () => {
    expect(maskReplayAttribute("aria-label", "Bertrand account")).toBe("[masked]")
    expect(maskReplayAttribute("value", "person@example.com")).toBe("[masked]")
    expect(maskReplayAttribute("style", "background-image:url(/private/person.png)")).toBe("[masked]")
    expect(maskReplayAttribute("class", "grid gap-4")).toBe("grid gap-4")
    expect(
      maskReplayAttribute(
        "href",
        "/repreneurs/019fd674-9442-7000-a255-fa06c75772d7?source=private",
      ),
    ).toBe("/repreneurs/:id")
  })

  it("redacts diagnostic strings", () => {
    expect(
      sanitizeDiagnosticText(
        "Failed for person@example.com 019fd674-9442-7000-a255-fa06c75772d7",
      ),
    ).toBe("Failed for [email] [id]")
  })

  it("allowlists custom events and properties", () => {
    const beforeSend = createBeforeSend(context)
    const result = beforeSend({
      uuid: "019fd674-9442-7000-a255-fa06c75772d7",
      event: "wave_action_succeeded",
      properties: {
        token: "phc_publicprojecttoken1234567890",
        distinct_id: "019fd674-9442-7000-a255-fa06c75772d7",
        $current_url:
          "https://app.re-new.team/opportunities/019fd674-9442-7000-a255-fa06c75772d7?contact=person@example.com",
        route_template:
          "/opportunities/019fd674-9442-7000-a255-fa06c75772d7?contact=person@example.com",
        surface: "staff",
        role: "staff",
        workflow: "opportunity_management",
        action: "save",
        outcome: "success",
        email: "person@example.com",
        company: "Private Company",
        opportunity_id: "019fd674-9442-7000-a255-fa06c75772d7",
      },
    } as CaptureResult)

    expect(result?.properties).toMatchObject({
      environment: "production",
      release: "1200.abc1234",
      is_test: false,
      route_template: "/opportunities/:id",
      surface: "staff",
      role: "staff",
      workflow: "opportunity_management",
      action: "save",
      outcome: "success",
      $current_url: "https://app.re-new.team/opportunities/:id",
      token: "phc_publicprojecttoken1234567890",
    })
    expect(result?.properties).not.toHaveProperty("email")
    expect(result?.properties).not.toHaveProperty("company")
    expect(result?.properties).not.toHaveProperty("opportunity_id")
  })

  it("redacts exception content while retaining normalized stack location", () => {
    const beforeSend = createBeforeSend(context)
    const result = beforeSend({
      uuid: "019fd674-9442-7000-a255-fa06c75772d7",
      event: "$exception",
      properties: {
        $current_url:
          "https://app.re-new.team/repreneurs/019fd674-9442-7000-a255-fa06c75772d7?email=person@example.com",
        $exception_list: [
          {
            type: "TypeError",
            value: "Could not load person@example.com",
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://app.re-new.team/repreneurs/019fd674-9442-7000-a255-fa06c75772d7?email=person@example.com",
                  function: "loadRepreneur",
                  lineno: 42,
                  colno: 7,
                },
              ],
            },
          },
        ],
      },
    } as CaptureResult)

    const exceptionList = result?.properties.$exception_list as Array<{
      value: string
      stacktrace: { frames: Array<{ filename: string }> }
    }>
    expect(exceptionList[0].value).toBe("[redacted]")
    expect(exceptionList[0].stacktrace.frames[0].filename).toBe(
      "https://app.re-new.team/repreneurs/:id",
    )
  })

  it("rejects non-contract automatic events", () => {
    const beforeSend = createBeforeSend(context)
    expect(
      beforeSend({
        uuid: "019fd674-9442-7000-a255-fa06c75772d7",
        event: "$autocapture",
        properties: { $el_text: "private text" },
      } as CaptureResult),
    ).toBeNull()
  })
})
