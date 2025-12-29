import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowRight, Users, TrendingUp, Compass } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: repreneurs } = await supabase.from("repreneurs").select("*")

  const { data: recentNotes } = await supabase
    .from("notes")
    .select(`
      id,
      content,
      created_at,
      created_by,
      repreneur_id,
      repreneurs (
        id,
        first_name,
        last_name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(5)

  // Calculate stats
  const totalRepreneurs = repreneurs?.length || 0
  const leadCount = repreneurs?.filter((r) => r.lifecycle_status === "lead").length || 0
  const qualifiedCount = repreneurs?.filter((r) => r.lifecycle_status === "qualified").length || 0
  const clientCount = repreneurs?.filter((r) => r.lifecycle_status === "client").length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your repreneur pipeline</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Repreneurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{totalRepreneurs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-semibold">{leadCount}</p>
              <StatusBadge status="lead" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-semibold">{qualifiedCount}</p>
              <StatusBadge status="qualified" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-semibold">{clientCount}</p>
              <StatusBadge status="client" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest notes from your team</CardDescription>
        </CardHeader>
        <CardContent>
          {recentNotes && recentNotes.length > 0 ? (
            <div className="space-y-4">
              {recentNotes.map((note: any) => (
                <div key={note.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/repreneurs/${note.repreneur_id}`} className="font-medium hover:underline">
                        {note.repreneurs.first_name} {note.repreneurs.last_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pipeline View
            </CardTitle>
            <CardDescription>Visualize your repreneur pipeline in a kanban board</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/pipeline">
              <Button className="w-full">
                Go to Pipeline
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Repreneurs
            </CardTitle>
            <CardDescription>View and manage all repreneurs in a detailed list</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/repreneurs">
              <Button className="w-full">
                View Repreneurs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5" />
              Repreneur Journey
            </CardTitle>
            <CardDescription>Track repreneurs through their acquisition journey</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/journey">
              <Button className="w-full">
                View Journey
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
