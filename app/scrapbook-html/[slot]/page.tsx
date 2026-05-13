import { notFound } from "next/navigation"
import { ScrapbookHtmlPage } from "../../scrapbook-html-page"

export const dynamic = "force-dynamic"

const VALID_SLOTS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])

export default async function Page({
  params,
}: {
  params: Promise<{ slot: string }>
}) {
  const { slot } = await params

  if (!VALID_SLOTS.has(slot)) {
    notFound()
  }

  return ScrapbookHtmlPage({ slot: Number(slot) })
}
