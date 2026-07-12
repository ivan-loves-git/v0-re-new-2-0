import Link from "next/link"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepreneurForm } from "@/components/repreneurs/repreneur-form"
import { createRepreneur } from "@/lib/actions/repreneurs"
import { SectionPageHeader } from "@/components/ui/section-page-header"

export default function NewRepreneurPage() {
  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="New repreneur"
        subtitle="Create the core record, then collect qualification data through the intake workflow"
        icon={UserPlus}
        tone="repreneur"
        actions={<Button asChild variant="outline" size="sm"><Link href="/repreneurs"><ArrowLeft className="size-4" />Back to repreneurs</Link></Button>}
      />

      <RepreneurForm action={createRepreneur} submitLabel="Create Repreneur" />
    </div>
  )
}
