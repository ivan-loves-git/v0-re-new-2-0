import { redirect } from "next/navigation"

interface MaPageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function MaPage({ searchParams }: MaPageProps) {
  const { view } = await searchParams
  const destination =
    view === "firms" || view === "contacts" ? view : "activity"
  redirect(`/opportunities/ma/${destination}`)
}
