import { z } from "zod"

const waitlistRequestSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200, "Name is too long."),
  email: z.string().trim().email("Please enter a valid email address.").max(254, "Email address is too long."),
  role: z.enum(["repreneur", "seller"]),
})

export function validateWaitlistRequest(name: string, email: string, role: unknown) {
  const parsed = waitlistRequestSchema.safeParse({ name, email, role })
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Check your request details." }

  return {
    success: true as const,
    data: {
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
    },
  }
}
