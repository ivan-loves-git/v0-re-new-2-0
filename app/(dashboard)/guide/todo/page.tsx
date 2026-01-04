import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Mail, Shield } from "lucide-react"
import Link from "next/link"

export const revalidate = 3600 // Cache for 1 hour

interface TodoItem {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: "pending" | "in_progress" | "blocked"
  category: string
  steps?: string[]
  links?: { label: string; url: string }[]
}

const pendingTodos: TodoItem[] = [
  {
    id: "resend-domain",
    title: "Verify Email Domain in Resend",
    description: "Currently emails can only be sent to myworkmail4@gmail.com (sandbox mode). To send emails to any repreneur, you need to verify a domain.",
    priority: "high",
    status: "pending",
    category: "Email System",
    steps: [
      "Go to resend.com/domains",
      "Click 'Add Domain'",
      "Enter your domain (e.g., renew.com or a subdomain like mail.renew.com)",
      "Add the DNS records Resend provides to your domain registrar",
      "Wait for verification (usually 24-48 hours)",
      "Update RESEND_FROM_EMAIL in Vercel environment variables to use your verified domain",
    ],
    links: [
      { label: "Resend Domain Setup", url: "https://resend.com/domains" },
      { label: "Vercel Environment Variables", url: "https://vercel.com/ivan-loves-git/v0-re-new-2-0/settings/environment-variables" },
    ],
  },
  {
    id: "production-env",
    title: "Review Production Environment Variables",
    description: "Ensure all required environment variables are properly configured in Vercel for production use.",
    priority: "high",
    status: "pending",
    category: "Infrastructure",
    steps: [
      "Verify RESEND_API_KEY is set and valid",
      "Verify RESEND_FROM_EMAIL matches your verified domain",
      "Verify Supabase URLs and keys are correct",
      "Test email sending after domain verification",
    ],
    links: [
      { label: "Vercel Settings", url: "https://vercel.com/ivan-loves-git/v0-re-new-2-0/settings/environment-variables" },
    ],
  },
  {
    id: "flatchr-import",
    title: "Import Data from Flatchr",
    description: "Migrate existing repreneur data from Flatchr ATS to Wave. This requires getting an export from Flatchr and running the import script.",
    priority: "medium",
    status: "pending",
    category: "Data Migration",
    steps: [
      "Request CSV/JSON export from Flatchr",
      "Review the export format and map fields to Wave schema",
      "Run import script (to be created based on export format)",
      "Verify imported data in Wave",
    ],
  },
  {
    id: "team-onboarding",
    title: "Team Onboarding",
    description: "Create accounts for team members who will use Wave and provide training on the platform.",
    priority: "medium",
    status: "pending",
    category: "Team",
    steps: [
      "Create user accounts in Supabase Auth",
      "Share login credentials securely",
      "Walk through the main features: Repreneurs, Pipeline, Emails",
      "Review the Instructions and Roadmap pages",
    ],
  },
]

const getPriorityColor = (priority: TodoItem["priority"]) => {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-700 border-red-200"
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "low":
      return "bg-blue-50 text-blue-700 border-blue-200"
  }
}

const getStatusIcon = (status: TodoItem["status"]) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-gray-400" />
    case "in_progress":
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    case "blocked":
      return <AlertCircle className="h-4 w-4 text-red-500" />
  }
}

export default function TodoPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">To Do</h1>
        <p className="text-gray-600 mt-2">
          Pending items for the founding team to complete
        </p>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-amber-800">
            <AlertCircle className="h-5 w-5" />
            Action Required
          </CardTitle>
          <CardDescription className="text-amber-700">
            {pendingTodos.length} items need attention before Wave is fully operational
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-gray-600">
                {pendingTodos.filter(t => t.priority === "high").length} High Priority
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-gray-600">
                {pendingTodos.filter(t => t.priority === "medium").length} Medium Priority
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Todo Items */}
      <div className="space-y-4">
        {pendingTodos.map((todo) => (
          <Card key={todo.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(todo.status)}
                  <div>
                    <CardTitle className="text-base">{todo.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(todo.priority)}`}>
                        {todo.priority}
                      </span>
                      <span className="text-xs text-gray-500">{todo.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{todo.description}</p>

              {todo.steps && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    {todo.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {todo.links && todo.links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {todo.links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Helpful Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Need Help?</p>
              <p className="mt-1">
                If you get stuck on any of these items, contact your developer or create an issue in the{" "}
                <a
                  href="https://github.com/ivan-loves-git/v0-re-new-2-0/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  GitHub repository
                </a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
