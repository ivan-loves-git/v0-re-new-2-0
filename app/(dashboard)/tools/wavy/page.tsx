import { redirect } from "next/navigation"

export default async function RetiredWavyPage({
  searchParams,
}: {
  searchParams: Promise<{ repreneur?: string }>
}) {
  const params = await searchParams
  const repreneur = /^[0-9a-f-]{36}$/i.test(params.repreneur ?? "")
    ? `?repreneur=${params.repreneur}`
    : ""
  redirect(`/tools/wave-ai${repreneur}`)
}
