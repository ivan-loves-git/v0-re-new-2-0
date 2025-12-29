import { redirect } from "next/navigation"

export default function HomePage() {
  console.log("[v0] HomePage: Redirecting to /dashboard")
  redirect("/dashboard")
}
