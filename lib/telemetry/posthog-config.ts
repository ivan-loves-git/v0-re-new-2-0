import type { PostHogConfig } from "posthog-js"
import {
  POSTHOG_EU_INGESTION_HOST,
  POSTHOG_EU_UI_HOST,
  type ClientTelemetryConfig,
} from "@/lib/telemetry/config"
import {
  createBeforeSend,
  maskCapturedNetworkRequest,
  maskReplayAttribute,
  normalizeUrl,
} from "@/lib/telemetry/privacy"

const SENSITIVE_SELECTOR = [
  ".ph-no-capture",
  "[data-ph-sensitive]",
  "[data-private]",
  "[data-sensitive]",
  "img",
  "picture",
  "video",
  "audio",
  "canvas",
  "object",
  "embed",
].join(",")

export const WAVE_REPLAY_START_OVERRIDE = {
  sampling: true,
  linked_flag: true,
  url_trigger: true,
  event_trigger: true,
} as const

export function buildPostHogBrowserConfig(
  config: ClientTelemetryConfig,
  options: { isHttps: boolean },
): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_EU_INGESTION_HOST,
    ui_host: POSTHOG_EU_UI_HOST,
    defaults: "2026-06-25",
    autocapture: false,
    rageclick: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    person_profiles: "identified_only",
    opt_out_useragent_filter: config.isTest,
    persistence: "localStorage+cookie",
    cross_subdomain_cookie: false,
    secure_cookie: options.isHttps,
    save_referrer: false,
    save_campaign_params: false,
    disable_capture_url_hashes: true,
    mask_personal_data_properties: true,
    custom_personal_data_properties: [
      "email",
      "name",
      "first_name",
      "last_name",
      "company",
      "crm_id",
      "repreneur_id",
      "opportunity_id",
      "prompt",
      "generated_content",
      "request_body",
      "response_body",
      "subject",
      "body",
      "note",
    ],
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true,
    },
    error_tracking: {
      captureExtensionExceptions: false,
      exception_steps: { enabled: false },
    },
    // Console payloads can contain arbitrary business or personal data. Keep
    // automatic exception capture, but never attach console content to replays.
    enable_recording_console_log: false,
    capture_performance: {
      network_timing: true,
      web_vitals: true,
      web_vitals_attribution: false,
    },
    disable_session_recording: false,
    session_recording: {
      blockClass: "ph-no-capture",
      blockSelector: SENSITIVE_SELECTOR,
      maskTextClass: "ph-mask",
      maskTextSelector: "*",
      maskAllInputs: true,
      maskAttributeFn: maskReplayAttribute,
      slimDOMOptions: "all",
      collectFonts: false,
      recordCrossOriginIframes: false,
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      maskCapturedNetworkRequestFn: maskCapturedNetworkRequest,
    },
    get_current_url: (url) =>
      normalizeUrl(url) ?? "https://wave.invalid/unknown",
    before_send: createBeforeSend({
      environment: config.environment,
      release: config.release,
      isTest: config.isTest,
    }),
  }
}
