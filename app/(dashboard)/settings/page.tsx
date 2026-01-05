import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Palette, Shield } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your preferences</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure how you receive updates</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Notification settings coming soon. You will be able to configure email alerts for new intake forms,
              follow-up reminders, and team activity.
            </p>
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Appearance settings coming soon. You will be able to toggle dark mode and adjust
              display preferences.
            </p>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Account security options</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              To change your password or update security settings, please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
