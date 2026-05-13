import { ScrapbookHtmlPage } from "../scrapbook-html-page"

export const dynamic = "force-dynamic"

export default async function Page() {
  return ScrapbookHtmlPage({ slot: 7 })
}
