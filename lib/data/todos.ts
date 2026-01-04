export interface TodoItem {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: "pending" | "in_progress" | "completed"
  category: string
  owner: string
  submittedAt: string
  steps?: string[]
  links?: { label: string; url: string }[]
}

// Only HIGH priority items that need immediate attention
export const pendingTodos: TodoItem[] = [
  {
    id: "resend-domain",
    title: "Verify Email Domain in Resend",
    description: "Currently emails can only be sent to myworkmail4@gmail.com (sandbox mode). To send emails to any repreneur, you need to verify a domain.",
    priority: "high",
    status: "pending",
    category: "Email System",
    owner: "Bertrand",
    submittedAt: "2026-01-04",
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
    owner: "Bertrand",
    submittedAt: "2026-01-04",
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
]

// Helper to get pending count
export const getPendingCount = () => pendingTodos.filter(t => t.status === "pending").length
