import sanitizeHtmlLibrary from "sanitize-html"

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
]

export function sanitizePublicHtml(value: string) {
  return sanitizeHtmlLibrary(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => {
        const { target, ...safeAttributes } = attribs
        return {
          tagName: "a",
          attribs: {
            ...safeAttributes,
            rel: "noopener noreferrer",
            ...(target === "_blank" ? { target: "_blank" } : {}),
          },
        }
      },
    },
  })
}

export function plainTextToSafeHtml(value: string) {
  return value
    .split("\n\n")
    .filter((paragraph) => paragraph.trim())
    .map(
      (paragraph) =>
        `<p>${sanitizeHtmlLibrary(paragraph, {
          allowedTags: [],
          allowedAttributes: {},
          disallowedTagsMode: "escape",
        }).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n")
}
