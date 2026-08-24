export function syntheticPdfBytes(pageCount = 1) {
  const pageObjectNumbers = Array.from(
    { length: pageCount },
    (_, index) => index + 3,
  )
  const contentObjectNumber = pageCount + 3
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...pageObjectNumbers.map(
      () =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjectNumber} 0 R >>`,
    ),
    "<< /Length 0 >>\nstream\n\nendstream",
  ]
  let source = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(source, "latin1"))
    source += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(source, "latin1")
  source += `xref\n0 ${objects.length + 1}\n`
  source += "0000000000 65535 f \n"
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, "0")} 00000 n \n`
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  source += `startxref\n${xrefOffset}\n%%EOF\n`
  return new Uint8Array(Buffer.from(source, "latin1"))
}
