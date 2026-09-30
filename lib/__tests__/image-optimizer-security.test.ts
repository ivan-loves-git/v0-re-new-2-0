import { readFile } from "node:fs/promises"
import { imageOptimizer } from "next/dist/server/image-optimizer"
import sharp from "sharp"
import { describe, expect, it } from "vitest"

const config = {
  experimental: {},
  images: { dangerouslyAllowSVG: false, minimumCacheTTL: 60 },
}

function optimize(buffer: Buffer, contentType: string, href: string) {
  return imageOptimizer(
    { buffer, contentType, etag: "synthetic-image", cacheControl: "max-age=60" },
    { href, width: 32, quality: 75, mimeType: "image/webp" },
    config,
    { silent: true },
  )
}

describe("installed image optimizer security boundary", () => {
  // AVIF optimization was restored upstream once sharp shipped patched libheif.
  // Keep that native prerequisite explicit before exercising malformed input.
  // https://github.com/vercel/next.js/pull/97949
  it("uses libheif with the AVIF decoder security fixes", () => {
    expect(sharp.versions.heif).toBeDefined()
    const [major, minor, patch] = sharp.versions.heif.split(".").map(Number)
    const patched = major > 1 || (major === 1 && (minor > 23 || (minor === 23 && patch >= 2)))
    expect(patched).toBe(true)
  })

  // Harmless truncated headers must report corruption and retain sniffed AVIF
  // in the unoptimized fallback, even when the upstream MIME type is spoofed.
  it.each(["image/avif", "image/jpeg"])(
    "reports corrupt AVIF input even when declared as %s",
    async (declaredType) => {
      const avifHeader = Buffer.from("00000018667479706176696600000000", "hex")
      const result = await optimize(avifHeader, declaredType, "/synthetic-avatar.jpg")
      expect(result.buffer).toBe(avifHeader)
      expect(result.contentType).toBe("image/avif")
      expect(result.error).toBeInstanceOf(Error)
    },
  )

  it("still resizes an ordinary public avatar", async () => {
    const avatar = await readFile("public/avatars/default-1.png")
    const result = await optimize(avatar, "image/png", "/avatars/default-1.png")
    expect(result.error).toBeUndefined()
    expect(result.contentType).toBe("image/webp")
    expect((await sharp(result.buffer).metadata()).width).toBe(32)
  })

  it("keeps disallowed SVG input outside the decoder", async () => {
    await expect(
      optimize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml", "/synthetic.svg"),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
