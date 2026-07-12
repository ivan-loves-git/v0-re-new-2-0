import { getCurrentUser } from "@/lib/auth-server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Calendar } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"

export default async function AccountPage() {
  const user = await getCurrentUser()

  // Get user info
  const userEmail = user?.email || "unknown@renew.com"
  const userName = user?.name || userEmail.split("@")[0]
  const userCreatedAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }) : "Unknown"

  // Generate initials for avatar
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SectionPageHeader title="Account" subtitle="Your Re-New workspace identity and access details" icon={User} tone="neutral" />

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your Re-New team member profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4">
              <Avatar className="size-20 rounded-xl">
                <AvatarImage src={user?.image || undefined} alt={userName} />
                <AvatarFallback className="rounded-xl bg-primary text-xl text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{userName}</h2>
                <p className="text-muted-foreground">Re-New Team Member</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid gap-4 pt-4 border-t">
              <div className="grid grid-cols-[40px_1fr] items-center gap-3 rounded-md border bg-muted/30 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <User className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Display Name</p>
                  <p className="font-medium">{userName}</p>
                </div>
              </div>

              <div className="grid grid-cols-[40px_1fr] items-center gap-3 rounded-md border bg-muted/30 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Mail className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{userEmail}</p>
                </div>
              </div>

              <div className="grid grid-cols-[40px_1fr] items-center gap-3 rounded-md border bg-muted/30 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{userCreatedAt}</p>
                </div>
              </div>
            </div>

            {/* Note about editing */}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                To update your profile or change your password, please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
