import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8")

function themeTokens(selector: ":root" | ".dark") {
  const escaped = selector === ".dark" ? "\\.dark" : selector
  const block = css.match(new RegExp(`^${escaped} \\{([^}]+)\\}`, "m"))?.[1]
  if (!block) throw new Error(`Missing ${selector} theme`)
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*(oklch\([^;]+\));/g)].map((match) => [match[1], match[2]]),
  )
}

// WCAG relative luminance after converting OKLCH to linear sRGB. Values outside
// the display gamut are clipped, matching the contrast floor for these tokens.
function luminance(value: string) {
  const match = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
  if (!match) throw new Error(`Expected a solid OKLCH token, got ${value}`)
  const [, lightness, chroma, hue] = match.map(Number)
  const angle = (hue * Math.PI) / 180
  const a = chroma * Math.cos(angle)
  const b = chroma * Math.sin(angle)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  const clip = (channel: number) => Math.max(0, Math.min(1, channel))
  return 0.2126 * clip(red) + 0.7152 * clip(green) + 0.0722 * clip(blue)
}

function contrast(tokens: Map<string, string>, foreground: string, background: string) {
  const front = tokens.get(foreground)
  const back = tokens.get(background)
  if (!front || !back) throw new Error(`Missing ${foreground} or ${background}`)
  const lighter = Math.max(luminance(front), luminance(back))
  const darker = Math.min(luminance(front), luminance(back))
  return (lighter + 0.05) / (darker + 0.05)
}

const textPairs = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["invert-foreground", "invert"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["muted-foreground", "card"],
  ["success", "card"],
  ["warning", "card"],
  ["info", "card"],
  ["destructive", "card"],
] as const

describe.each([["light", ":root"], ["dark", ".dark"]] as const)("%s theme", (_mode, selector) => {
  const tokens = themeTokens(selector)
  it.each(textPairs)("keeps %s on %s readable", (foreground, background) => {
    expect(contrast(tokens, foreground, background)).toBeGreaterThanOrEqual(4.5)
  })
})
