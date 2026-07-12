import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Palette, Shield } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SectionPageHeader title="Settings" subtitle="Workspace preferences, notifications, appearance, and access" icon={Shield} tone="neutral" />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure how you receive updates</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-5 text-muted-foreground">
              Notification settings coming soon. You will be able to configure email alerts for new intake forms,
              follow-up reminders, and team activity.
            </p>
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-5 text-muted-foreground">
              Appearance settings coming soon. You will be able to toggle dark mode and adjust
              display preferences.
            </p>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              Security
            </CardTitle>
            <CardDescription>Account security options</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-5 text-muted-foreground">
              To change your password or update security settings, please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
