import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Beaker } from "lucide-react"

export default function DevelopmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Development</h1>
        <p className="text-gray-500 mt-1">
          Testing area for new features and iterations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Experiments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active experiments. Add component variants here to test before deploying.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
