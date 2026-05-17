import { redirect } from "next/navigation"
import { getPostLoginDestination } from "@/lib/access-control"

export default async function RoutingPage() {
  redirect(await getPostLoginDestination())
}
