import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Calendar } from "lucide-react"

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user info
  const userEmail = user?.email || "unknown@renew.com"
  const userName = user?.user_metadata?.full_name || userEmail.split("@")[0]
  const userCreatedAt = user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Account</h1>
        <p className="text-gray-600 mt-1">Your profile information</p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your Re-New team member profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 rounded-xl">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={userName} />
                <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{userName}</h2>
                <p className="text-gray-500">Re-New Team Member</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid gap-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Display Name</p>
                  <p className="font-medium">{userName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <Mail className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{userEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-medium">{userCreatedAt}</p>
                </div>
              </div>
            </div>

            {/* Note about editing */}
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">
                To update your profile or change your password, please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
