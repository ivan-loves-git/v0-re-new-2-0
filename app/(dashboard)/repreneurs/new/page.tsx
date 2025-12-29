import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepreneurForm } from "@/components/repreneurs/repreneur-form"
import { createRepreneur } from "@/lib/actions/repreneurs"

export default function NewRepreneurPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/repreneurs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repreneurs
          </Button>
        </Link>
      </div>

      <RepreneurForm action={createRepreneur} submitLabel="Create Repreneur" />
    </div>
  )
}
