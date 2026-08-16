import "server-only"

import { inflateRawSync } from "node:zlib"

const textDecoder = new TextDecoder("utf-8", { fatal: true })
const latinDecoder = new TextDecoder("latin1")

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  if (offset < 0 || offset + signature.length > bytes.length) return false
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false
  }
  return true
}

function u16le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function u32le(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function u32be(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

type ZipEntry = { name: string; content: Uint8Array }

function parseZip(bytes: Uint8Array): Map<string, ZipEntry> | null {
  const searchStart = Math.max(0, bytes.length - 65_557)
  let eocd = -1
  for (let index = bytes.length - 22; index >= searchStart; index -= 1) {
    if (startsWith(bytes, [0x50, 0x4b, 0x05, 0x06], index)) { eocd = index; break }
  }
  if (eocd < 0 || eocd + 22 + u16le(bytes, eocd + 20) !== bytes.length) return null
  const entriesCount = u16le(bytes, eocd + 10)
  const centralSize = u32le(bytes, eocd + 12)
  const centralOffset = u32le(bytes, eocd + 16)
  if (!entriesCount || entriesCount > 4096 || centralOffset + centralSize !== eocd) return null

  const entries = new Map<string, ZipEntry>()
  let cursor = centralOffset
  let totalUncompressed = 0
  try {
    for (let index = 0; index < entriesCount; index += 1) {
      if (!startsWith(bytes, [0x50, 0x4b, 0x01, 0x02], cursor)) return null
      const flags = u16le(bytes, cursor + 8)
      const method = u16le(bytes, cursor + 10)
      const expectedCrc = u32le(bytes, cursor + 16)
      const compressedSize = u32le(bytes, cursor + 20)
      const uncompressedSize = u32le(bytes, cursor + 24)
      const nameLength = u16le(bytes, cursor + 28)
      const extraLength = u16le(bytes, cursor + 30)
      const commentLength = u16le(bytes, cursor + 32)
      const localOffset = u32le(bytes, cursor + 42)
      const next = cursor + 46 + nameLength + extraLength + commentLength
      if (!nameLength || next > eocd || (flags & 1) !== 0 || ![0, 8].includes(method)) return null
      const name = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)).replaceAll("\\", "/")
      const normalized = name.toLowerCase()
      if (name.startsWith("/") || name.split("/").some((part) => part === "..") || entries.has(normalized)) return null
      if (/(^|\/)([^/]+\.)?(exe|dll|com|bat|cmd|js|jse|vbs|vbe|ps1|sh|html?|svg|jar|bin|zip|rar|7z)$/i.test(name) || /vbaproject/i.test(name)) return null
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04], localOffset)) return null
      const localNameLength = u16le(bytes, localOffset + 26)
      const localExtraLength = u16le(bytes, localOffset + 28)
      const dataStart = localOffset + 30 + localNameLength + localExtraLength
      const dataEnd = dataStart + compressedSize
      if (dataEnd > centralOffset || textDecoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)).replaceAll("\\", "/") !== name) return null
      totalUncompressed += uncompressedSize
      if (uncompressedSize > 32 * 1024 * 1024 || totalUncompressed > 64 * 1024 * 1024) return null
      const compressed = bytes.subarray(dataStart, dataEnd)
      const content = method === 0
        ? Uint8Array.from(compressed)
        : Uint8Array.from(inflateRawSync(compressed, { maxOutputLength: uncompressedSize || 1 }))
      if (content.length !== uncompressedSize || crc32(content) !== expectedCrc) return null
      if (
        startsWith(content, [0x50,0x4b,0x03,0x04])
        || startsWith(content, [0x52,0x61,0x72,0x21,0x1a,0x07,0x00])
        || startsWith(content, [0x52,0x61,0x72,0x21,0x1a,0x07,0x01,0x00])
        || startsWith(content, [0x37,0x7a,0xbc,0xaf,0x27,0x1c])
      ) return null
      entries.set(normalized, { name, content })
      cursor = next
    }
  } catch { return null }
  return cursor === eocd ? entries : null
}

function safeXml(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) return null
  try {
    const text = textDecoder.decode(bytes)
    return /<!DOCTYPE|<!ENTITY|<script\b|<svg\b/i.test(text) ? null : text
  } catch { return null }
}

function validOoxml(bytes: Uint8Array, kind: "docx" | "xlsx") {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false
  const entries = parseZip(bytes)
  if (!entries) return false
  const mainPath = kind === "docx" ? "word/document.xml" : "xl/workbook.xml"
  const contentTypes = safeXml(entries.get("[content_types].xml")?.content ?? new Uint8Array())
  const relationships = safeXml(entries.get("_rels/.rels")?.content ?? new Uint8Array())
  const main = safeXml(entries.get(mainPath)?.content ?? new Uint8Array())
  if (!contentTypes || !relationships || !main) return false
  const expectedContentType = kind === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
  return /<Types\b/i.test(contentTypes)
    && contentTypes.includes(expectedContentType)
    && /<Relationships\b/i.test(relationships)
    && relationships.includes(mainPath)
    && (kind === "docx" ? /<w:document\b/i.test(main) : /<(?:\w+:)?workbook\b/i.test(main))
}

function validPdf(bytes: Uint8Array) {
  if (bytes.length < 64 || !startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e])) return false
  const text = latinDecoder.decode(bytes)
  if (!/%%EOF\s*$/.test(text) || !/\d+\s+\d+\s+obj\b/.test(text)) return false
  const decodedNames = text.replace(/#[0-9a-f]{2}/gi, (escape) => String.fromCharCode(Number.parseInt(escape.slice(1), 16)))
  if (/\/(?:OpenAction|AA|AcroForm|XFA|JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/i.test(decodedNames)) return false
  if (/<!doctype\s+html|<html\b|<script\b|<svg\b/i.test(text)) return false
  if (text.includes("PK\u0003\u0004") || text.includes("MZ\u0090") || text.includes("\u007fELF")) return false
  const startXref = text.match(/startxref\s+(\d+)\s+%%EOF\s*$/)
  if (!startXref) return false
  const xrefOffset = Number(startXref[1])
  if (!Number.isSafeInteger(xrefOffset) || xrefOffset < 9 || xrefOffset >= bytes.length) return false
  const xrefText = text.slice(xrefOffset, Math.min(bytes.length, xrefOffset + 512))
  return xrefText.startsWith("xref") || (/^\d+\s+\d+\s+obj\b/.test(xrefText) && /\/Type\s*\/XRef\b/.test(xrefText))
}

function validPng(bytes: Uint8Array) {
  if (!startsWith(bytes, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return false
  let cursor = 8
  let sawHeader = false
  let sawImageData = false
  while (cursor + 12 <= bytes.length) {
    const length = u32be(bytes, cursor)
    const typeBytes = bytes.subarray(cursor + 4, cursor + 8)
    const type = latinDecoder.decode(typeBytes)
    const dataStart = cursor + 8
    const dataEnd = dataStart + length
    const next = dataEnd + 4
    if (next > bytes.length || crc32(bytes.subarray(cursor + 4, dataEnd)) !== u32be(bytes, dataEnd)) return false
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return false
      const width = u32be(bytes, dataStart)
      const height = u32be(bytes, dataStart + 4)
      if (!width || !height || bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || bytes[dataStart + 12] > 1) return false
      sawHeader = true
    } else if (type === "IHDR") return false
    if (type === "IDAT" && length > 0) sawImageData = true
    if (type === "IEND") return length === 0 && sawHeader && sawImageData && next === bytes.length
    cursor = next
  }
  return false
}

function validJpegQuantizationTables(bytes: Uint8Array, cursor: number, length: number) {
  let offset = cursor + 2
  const end = cursor + length
  let tables = 0
  while (offset < end) {
    const precision = bytes[offset] >>> 4
    const tableId = bytes[offset] & 0x0f
    if (precision > 1 || tableId > 3) return false
    offset += 1 + 64 * (precision + 1)
    tables += 1
  }
  return tables > 0 && offset === end
}

function validJpegHuffmanTables(bytes: Uint8Array, cursor: number, length: number) {
  let offset = cursor + 2
  const end = cursor + length
  let tables = 0
  while (offset < end) {
    if (offset + 17 > end || (bytes[offset] >>> 4) > 1 || (bytes[offset] & 0x0f) > 3) return false
    let symbols = 0
    for (let index = 1; index <= 16; index += 1) symbols += bytes[offset + index]
    if (!symbols || symbols > 256 || offset + 17 + symbols > end) return false
    offset += 17 + symbols
    tables += 1
  }
  return tables > 0 && offset === end
}

function validJpeg(bytes: Uint8Array) {
  if (bytes.length < 32 || !startsWith(bytes, [0xff, 0xd8])) return false
  let cursor = 2
  let sawFrame = false
  let sawScan = false
  let sawQuantizationTable = false
  let sawHuffmanTable = false
  while (cursor < bytes.length) {
    if (bytes[cursor++] !== 0xff) return false
    while (bytes[cursor] === 0xff) cursor += 1
    const marker = bytes[cursor++]
    if (marker === 0xd9) return sawFrame && sawScan && sawQuantizationTable && sawHuffmanTable && cursor === bytes.length
    if (marker === 0xda) {
      if (!sawFrame || !sawQuantizationTable || !sawHuffmanTable || cursor + 3 > bytes.length) return false
      const scanLength = (bytes[cursor] << 8) | bytes[cursor + 1]
      const scanComponents = bytes[cursor + 2]
      if (!scanComponents || scanLength !== 6 + 2 * scanComponents || cursor + scanLength > bytes.length) return false
      let index = cursor + scanLength
      let sawEntropy = false
      while (index < bytes.length) {
        if (bytes[index] !== 0xff) {
          sawEntropy = true
          index += 1
          continue
        }
        const markerStart = index
        while (bytes[index] === 0xff) index += 1
        const scanMarker = bytes[index++]
        if (scanMarker === 0x00) {
          sawEntropy = true
          continue
        }
        if (scanMarker >= 0xd0 && scanMarker <= 0xd7) continue
        if (!sawEntropy) return false
        sawScan = true
        if (scanMarker === 0xd9) return sawQuantizationTable && sawHuffmanTable && index === bytes.length
        cursor = markerStart
        break
      }
      if (index >= bytes.length) return false
      continue
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (cursor + 2 > bytes.length) return false
    const length = (bytes[cursor] << 8) | bytes[cursor + 1]
    if (length < 2 || cursor + length > bytes.length) return false
    if (marker === 0xdb) {
      if (!validJpegQuantizationTables(bytes, cursor, length)) return false
      sawQuantizationTable = true
    }
    if (marker === 0xc4) {
      if (!validJpegHuffmanTables(bytes, cursor, length)) return false
      sawHuffmanTable = true
    }
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7].includes(marker)) {
      const components = bytes[cursor + 7]
      if (!components || length !== 8 + 3 * components || !((bytes[cursor + 3] << 8) | bytes[cursor + 4]) || !((bytes[cursor + 5] << 8) | bytes[cursor + 6])) return false
      sawFrame = true
    }
    cursor += length
  }
  return false
}

function skipGifSubBlocks(bytes: Uint8Array, start: number) {
  let cursor = start
  let payload = 0
  while (cursor < bytes.length) {
    const length = bytes[cursor++]
    if (!length) return payload ? cursor : -1
    payload += length
    cursor += length
    if (cursor > bytes.length) return -1
  }
  return -1
}

function validGif(bytes: Uint8Array) {
  const header = latinDecoder.decode(bytes.subarray(0, 6))
  if (bytes.length < 20 || !["GIF87a","GIF89a"].includes(header)) return false
  if (!u16le(bytes, 6) || !u16le(bytes, 8)) return false
  let cursor = 13
  if (bytes[10] & 0x80) cursor += 3 * (2 ** ((bytes[10] & 0x07) + 1))
  let sawImage = false
  while (cursor < bytes.length) {
    const marker = bytes[cursor++]
    if (marker === 0x3b) return sawImage && cursor === bytes.length
    if (marker === 0x21) {
      if (cursor >= bytes.length) return false
      cursor += 1
      cursor = skipGifSubBlocks(bytes, cursor)
      if (cursor < 0) return false
      continue
    }
    if (marker !== 0x2c || cursor + 9 > bytes.length) return false
    if (!u16le(bytes, cursor + 4) || !u16le(bytes, cursor + 6)) return false
    const packed = bytes[cursor + 8]
    cursor += 9
    if (packed & 0x80) cursor += 3 * (2 ** ((packed & 0x07) + 1))
    if (cursor >= bytes.length || bytes[cursor] < 2 || bytes[cursor] > 12) return false
    cursor = skipGifSubBlocks(bytes, cursor + 1)
    if (cursor < 0) return false
    sawImage = true
  }
  return false
}

function validWebp(bytes: Uint8Array) {
  if (bytes.length < 30 || !startsWith(bytes,[0x52,0x49,0x46,0x46]) || u32le(bytes,4)+8 !== bytes.length || latinDecoder.decode(bytes.subarray(8,12)) !== "WEBP") return false
  let cursor = 12
  let sawImage = false
  let sawExtendedHeader = false
  while (cursor + 8 <= bytes.length) {
    const type = latinDecoder.decode(bytes.subarray(cursor,cursor+4))
    const length = u32le(bytes,cursor+4)
    const data = cursor + 8
    const next = data + length + (length & 1)
    if (next > bytes.length) return false
    // VP8X is only an extended-container header. The dimensions are stored
    // minus one (so zero is valid), but a real VP8/VP8L payload must follow.
    if (type === "VP8X") {
      if (length !== 10 || sawExtendedHeader || cursor !== 12) return false
      sawExtendedHeader = true
    }
    if (type === "VP8L") sawImage ||= length >= 5 && bytes[data] === 0x2f && (bytes[data+4] & 0xe0) === 0
    if (type === "VP8 ") sawImage ||= length >= 10 && startsWith(bytes,[0x9d,0x01,0x2a],data+3) && (u16le(bytes,data+6)&0x3fff) > 0 && (u16le(bytes,data+8)&0x3fff) > 0
    cursor = next
  }
  return sawImage && cursor === bytes.length
}

function validCsv(bytes: Uint8Array) {
  if (!bytes.length || bytes.includes(0) || startsWith(bytes,[0x4d,0x5a]) || startsWith(bytes,[0x7f,0x45,0x4c,0x46]) || startsWith(bytes,[0x50,0x4b,0x03,0x04])) return false
  try {
    const text = textDecoder.decode(bytes).replace(/^\uFEFF/, "")
    if (!text.trim()) return false
    return !/<\s*[!?/]?[a-z][^>]*>/i.test(text)
      && !/\bon(?:load|error|click|mouseover|focus)\s*=/i.test(text)
      && !/javascript\s*:/i.test(text)
      && !/(?:^|[,;\t\r\n])[ \t]*"*[ \t]*[=+\-@]/m.test(text)
  } catch { return false }
}

/** Server-only complete-file inspection after the 20 MiB envelope check. */
export function matchesExpectedFileStructure(filename: string, bytes: Uint8Array) {
  const extension = filename.trim().toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1]
  if (extension === "pdf") return validPdf(bytes)
  if (extension === "docx" || extension === "xlsx") return validOoxml(bytes, extension)
  if (extension === "csv") return validCsv(bytes)
  if (extension === "png") return validPng(bytes)
  if (extension === "jpg" || extension === "jpeg") return validJpeg(bytes)
  if (extension === "gif") return validGif(bytes)
  if (extension === "webp") return validWebp(bytes)
  return false
}
