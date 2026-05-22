import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ScrapbookHtmlPage } from "../../scrapbook-html-page"


const VALID_SLOTS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])

export default function Page({
  params,
}: {
  params: Promise<{ slot: string }>
}) {
  return (
    <Suspense fallback={null}>
      <ScrapbookHtmlSlot params={params} />
    </Suspense>
  )
}

async function ScrapbookHtmlSlot({
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
