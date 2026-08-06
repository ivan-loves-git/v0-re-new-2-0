"use client"

import type React from "react"
import { Suspense, useEffect } from "react"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"
import {
  captureActionStarted,
  captureLogoutAndReset,
  capturePageView,
  identifyTelemetryUser,
  installWaveTelemetryTransport,
  onWaveTelemetryTransportReady,
  resetStaleIdentityOnLogin,
} from "@/lib/telemetry/runtime"
import { getClientTelemetryConfig } from "@/lib/telemetry/config"
import {
  buildPostHogBrowserConfig,
  WAVE_REPLAY_START_OVERRIDE,
} from "@/lib/telemetry/posthog-config"
import type {
  WaveAction,
  WaveTelemetryRole,
  WaveWorkflow,
} from "@/lib/telemetry/contract"
import {
  isWaveAction,
  isWaveWorkflow,
  workflowForRoute,
} from "@/lib/telemetry/privacy"

function explicitWorkflow(element: Element, pathname: string): WaveWorkflow {
  const value = element.closest<HTMLElement>("[data-wave-workflow]")
    ?.dataset.waveWorkflow
  return isWaveWorkflow(value) ? value : workflowForRoute(pathname)
}

function actionForControl(element: Element): WaveAction | null {
  const control = element.closest<HTMLElement>(
    "a[href],button,input[type='button'],input[type='submit'],[role='button']",
  )
  if (!control || control.closest("[data-wave-ignore-telemetry]")) return null

  const explicit = control.dataset.waveAction
  if (isWaveAction(explicit)) return explicit

  if (control instanceof HTMLAnchorElement) {
    return control.hasAttribute("download") ? "download" : "navigate"
  }
  if (
    (control instanceof HTMLButtonElement && control.type === "submit") ||
    (control instanceof HTMLInputElement && control.type === "submit")
  ) return null
  return "open"
}

function WaveTelemetryRouteObserver() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    resetStaleIdentityOnLogin(pathname)
    return onWaveTelemetryTransportReady(() => {
      capturePageView(pathname)
    })
  }, [pathname])

  return null
}

export function WaveTelemetryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const config = getClientTelemetryConfig()
    if (!config.enabled || !config.projectToken) return

    posthog.init(config.projectToken, {
      ...buildPostHogBrowserConfig(config, {
        isHttps: window.location.protocol === "https:",
      }),
      loaded: (instance) => {
        instance.startSessionRecording(WAVE_REPLAY_START_OVERRIDE)
      },
    })

    const uninstall = installWaveTelemetryTransport({
      capture(event, properties, options) {
        posthog.capture(
          event,
          properties,
          options?.sendInstantly ? { send_instantly: true } : undefined,
        )
      },
      identify(userId, properties) {
        posthog.identify(userId, properties)
      },
      reset(options) {
        posthog.reset(options.resetDeviceId)
      },
      register(properties) {
        posthog.register(properties)
      },
    })
    resetStaleIdentityOnLogin(window.location.pathname)
    capturePageView(window.location.pathname)
    return uninstall
  }, [])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const pathname = window.location.pathname || "/"
      const anchor = target.closest<HTMLAnchorElement>("a[href]")
      if (anchor) {
        try {
          const url = new URL(anchor.href, window.location.origin)
          if (url.origin === window.location.origin && url.pathname === "/auth/logout") {
            captureLogoutAndReset(pathname)
            return
          }
        } catch {
          // Navigation must remain unaffected by telemetry.
        }
      }

      const action = actionForControl(target)
      if (!action) return
      captureActionStarted(pathname, action, explicitWorkflow(target, pathname))
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      if (form.closest("[data-wave-ignore-telemetry]")) return
      const pathname = window.location.pathname || "/"
      const explicit = form.dataset.waveAction
      captureActionStarted(
        pathname,
        isWaveAction(explicit) ? explicit : "submit",
        explicitWorkflow(form, pathname),
      )
    }
    document.addEventListener("submit", onSubmit, true)
    return () => document.removeEventListener("submit", onSubmit, true)
  }, [])

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <WaveTelemetryRouteObserver />
      </Suspense>
    </>
  )
}

export function WaveTelemetryIdentity({
  userId,
  role,
}: {
  userId: string
  role: Exclude<WaveTelemetryRole, "anonymous">
}) {
  useEffect(
    () => onWaveTelemetryTransportReady(() => {
      identifyTelemetryUser(userId, role)
    }),
    [role, userId],
  )
  return null
}
