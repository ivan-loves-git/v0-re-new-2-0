"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TEMPLATE_METADATA } from "@/lib/email/templates"
import type { EmailLogEntry } from "@/lib/actions/emails"
import type { EmailTemplateKey } from "@/lib/types/email"

interface EmailLogProps {
  initialLogs: EmailLogEntry[]
  initialTotal: number
}

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  opened: "bg-purple-100 text-purple-800",
  clicked: "bg-indigo-100 text-indigo-800",
  bounced: "bg-red-100 text-red-800",
  complained: "bg-orange-100 text-orange-800",
}

const statusLabels: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  complained: "Complained",
}

export function EmailLog({ initialLogs, initialTotal }: EmailLogProps) {
  const [logs] = useState(initialLogs)
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filteredLogs = logs.filter((log) => {
    if (templateFilter !== "all" && log.template_key !== templateFilter) return false
    if (statusFilter !== "all" && log.status !== statusFilter) return false
    return true
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Email History ({initialTotal})</CardTitle>
          <div className="flex gap-2">
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {Object.entries(TEMPLATE_METADATA).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No emails found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.repreneur_name}</div>
                      <div className="text-sm text-muted-foreground">{log.repreneur_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TEMPLATE_METADATA[log.template_key as EmailTemplateKey]?.name || log.template_key}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[log.status] || "bg-gray-100 text-gray-800"}>
                      {statusLabels[log.status] || log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.sent_at).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.opened_at
                      ? new Date(log.opened_at).toLocaleDateString("en-US", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
