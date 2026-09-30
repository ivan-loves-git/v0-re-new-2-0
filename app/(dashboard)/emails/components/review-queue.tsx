"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import {
  Archive,
  BadgeCheck,
  ChevronDown,
  Clock,
  Filter,
  FileLock,
  FileSearch,
  Handshake,
  Mail,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import {
  useTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridSelectionBar } from "@/components/reui/data-grid/data-grid-selection-bar"
import { Badge, type BadgeProps } from "@/components/reui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  archiveStaffEmailReview,
  changeStaffEmailReviewArchiveSelection,
  getStaffEmailReview,
  restoreStaffEmailReview,
  type listStaffEmailReviews,
} from "@/lib/actions/staff-email-review"
import {
  getStaffEmailBulk,
  prepareStaffEmailBulk,
} from "@/lib/actions/staff-email-bulk"
import {
  EMAIL_REVIEW_PURPOSES,
  emailReviewDetailHref,
  isEmailReviewSelectable,
  parseEmailReviewQueueOptions,
  type EmailReviewPurpose,
  type EmailReviewQueueRow,
  type EmailReviewSort,
} from "@/lib/email/review-queue-query"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"
import { ReviewDetail } from "../review/[id]/review-detail"
import { BulkEmailConfirmation } from "../bulk/[id]/bulk-confirmation"
import { SingleEmailConfirmation } from "./single-confirmation"
import {
  initialReviewSearch,
  emailReviewSelectionContext,
  reviewQueueNavigationParams,
  reviewSearchReducer,
} from "@/lib/email/review-ui-transitions"
import "./review-queue.css"

type Queue = Awaited<ReturnType<typeof listStaffEmailReviews>>
type ReviewRecord = Awaited<ReturnType<typeof getStaffEmailReview>>
type BulkRecord = Awaited<ReturnType<typeof getStaffEmailBulk>>
type GridRow =
  | { id: string; kind: "group"; label: string; count: number; state: string }
  | { id: string; kind: "draft"; review: EmailReviewQueueRow }

const purposeVariant: Record<EmailReviewPurpose, BadgeProps["variant"]> = {
  source_freshness: "warning-light",
  ma_validity_check: "success-light",
  ma_more_information: "focus-light",
  ma_nda_memo_request: "info-light",
  ma_process_follow_up: "destructive-light",
  ma_interest_feedback: "primary-light",
  e4_qualification: "focus-light",
  e6_nda_ready: "info-light",
  e7_signed_copies: "info-light",
  ma_other: "outline",
}
const avatarTone = [
  "bg-primary/10 text-primary",
  "bg-destructive/10 text-destructive",
  "bg-green-50 text-green-600 dark:bg-green-900",
  "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900",
]
const avatarBorder = [
  "after:border-primary/10",
  "after:border-destructive/10",
  "after:border-green-200 dark:after:border-green-600",
  "after:border-fuchsia-200 dark:after:border-fuchsia-600",
]
const purposeIcons: Record<EmailReviewPurpose, typeof Mail> = {
  source_freshness: RefreshCw,
  ma_validity_check: BadgeCheck,
  ma_more_information: FileSearch,
  ma_nda_memo_request: FileLock,
  ma_process_follow_up: MessageCircle,
  ma_interest_feedback: Handshake,
  e4_qualification: FileLock,
  e6_nda_ready: FileLock,
  e7_signed_copies: FileLock,
  ma_other: Mail,
}
const purposeIconColors: Record<EmailReviewPurpose, string> = {
  source_freshness: "text-warning-foreground",
  ma_validity_check: "text-success-foreground",
  ma_more_information: "text-focus-foreground",
  ma_nda_memo_request: "text-info-foreground",
  ma_process_follow_up: "text-destructive-foreground",
  ma_interest_feedback: "text-primary",
  e4_qualification: "text-focus-foreground",
  e6_nda_ready: "text-info-foreground",
  e7_signed_copies: "text-info-foreground",
  ma_other: "text-muted-foreground",
}
const stateLabels: Record<EmailReviewQueueRow["state"], string> = {
  pending: "Pending review",
  sent: "Accepted by provider",
  failed: "Failed",
  sending: "Sending",
  uncertain: "Outcome uncertain",
  cancelled: "Cancelled",
}
function Recipient({ review }: { review: EmailReviewQueueRow }) {
  const parts = review.recipient_name?.trim().split(/\s+/).filter(Boolean) ?? []
  const initials = (
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.[0] ?? "?")
  ).toUpperCase()
  const hash = Array.from(review.recipient_email.toLowerCase()).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    0,
  )
  return (
    <div className="min-w-0 text-xs leading-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <Avatar
          className={`size-5 shrink-0 ${avatarBorder[hash % avatarBorder.length]}`}
          aria-hidden="true"
        >
          {review.source_kind === "e6" && review.recipient_avatar_url ? (
            <AvatarImage src={review.recipient_avatar_url} alt="" />
          ) : null}
          <AvatarFallback
            className={`${avatarTone[hash % avatarTone.length]} text-[9px] font-medium`}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className="truncate text-sm font-medium"
          title={review.recipient_name ?? "Name unavailable"}
        >
          {review.recipient_name ?? "Name unavailable"}
        </span>
      </div>
      <div
        className="truncate pl-[26px] text-muted-foreground"
        title={review.recipient_email}
      >
        {review.recipient_email}
      </div>
    </div>
  )
}
function preparedAt(value: string) {
  const day = formatDisplayDateTime(value, "en-US", {
    day: "numeric",
    month: "short",
  })
    .split(" ")
    .reverse()
    .join(" ")
  const hour = formatDisplayDateTime(value, "en-US", {
    hour: "numeric",
    hour12: true,
  }).replace(/\s/g, "")
  return `${day} ${hour}`
}
function fullPreparedAt(value: string) {
  return formatDisplayDateTime(value, "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}
function canPrepareSend(review: EmailReviewQueueRow) {
  return (
    review.namespace === "REAL" &&
    review.state === "pending" &&
    review.archived_at === null &&
    review.archive_eligible
  )
}

export function ReviewQueue({ queue }: { queue: Queue }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlSearch = parseEmailReviewQueueOptions({
    reviewSearch: searchParams.get("reviewSearch") ?? undefined,
  }).search
  const savedBatchId = searchParams.get("reviewBatch")
  const [pending, startTransition] = useTransition()
  const [searchState, updateSearch] = useReducer(
    reviewSearchReducer,
    queue.search,
    initialReviewSearch,
  )
  const search = searchState.value
  const [dense, setDense] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selection, setSelection] = useState<{
    pageKey: string
    rows: RowSelectionState
  }>({ pageKey: "", rows: {} })
  const [outcomes, setOutcomes] = useState<
    Array<{ label: string; outcome: string }>
  >([])
  const [selectedReview, setSelectedReview] =
    useState<EmailReviewQueueRow | null>(null)
  const [record, setRecord] = useState<ReviewRecord | null>(null)
  const [detailError, setDetailError] = useState("")
  const [batchRecord, setBatch] = useState<BulkRecord | null>(null)
  const batch = batchRecord?.batch.id === savedBatchId ? batchRecord : null
  const [savedBatchHref, setSavedBatchHref] = useState<string | null>(null)
  const [batchError, setBatchError] = useState("")
  const [singleConfirmation, setSingleConfirmation] =
    useState<ReviewRecord | null>(null)
  const batchRequest = useRef(0)
  const detailRequest = useRef(0)
  const pageKey = emailReviewSelectionContext(queue, queue.reviews)
  const rowSelection = selection.pageKey === pageKey ? selection.rows : {}
  const selectedRows = queue.reviews.filter(
    (review) => rowSelection[review.id] && isEmailReviewSelectable(review),
  )
  const selectedActive = selectedRows.filter(
    (review) => review.archived_at === null,
  )
  const selectedArchived = selectedRows.filter(
    (review) => review.archived_at !== null,
  )
  const canSendSelection =
    selectedRows.length >= 1 &&
    selectedRows.length <= 5 &&
    selectedRows.every(canPrepareSend)
  const groups = useMemo(() => {
    const keys = [
      "pending",
      "archived",
      "sent",
      "sending",
      "uncertain",
      "failed",
      "cancelled",
    ]
    return keys.flatMap((key) => {
      const reviews = queue.reviews.filter(
        (review) => (review.archived_at ? "archived" : review.state) === key,
      )
      return reviews.length
        ? [
            {
              id: `group:${key}`,
              kind: "group" as const,
              label:
                key === "archived"
                  ? "Archived"
                  : stateLabels[key as EmailReviewQueueRow["state"]],
              count: reviews.length,
              state: key,
              reviews,
            },
          ]
        : []
    })
  }, [queue.reviews])
  const data = groups.flatMap((group): GridRow[] => [
    {
      id: group.id,
      kind: "group",
      label: group.label,
      count: group.count,
      state: group.state,
    },
    ...(collapsed[group.id]
      ? []
      : group.reviews.map((review) => ({
          id: review.id,
          kind: "draft" as const,
          review,
        }))),
  ])
  const allExpanded = groups.every((group) => !collapsed[group.id])

  function clearSelection() {
    setSelection({ pageKey: "", rows: {} })
  }
  function navigate(changes: Record<string, string | null>) {
    setOutcomes([])
    const pureSort =
      ("reviewSort" in changes || "reviewDirection" in changes) &&
      Object.keys(changes).every((name) =>
        ["reviewSort", "reviewDirection", "reviewPage"].includes(name),
      ) &&
      search.trim() === queue.search
    if (!pureSort) clearSelection()
    const params = reviewQueueNavigationParams(
      searchParams.toString(),
      queue,
      search,
      changes,
    )
    const submittedSearch = params.get("reviewSearch") ?? ""
    if (submittedSearch !== urlSearch)
      updateSearch({ type: "submitted", value: submittedSearch })
    startTransition(() =>
      router.push(`${pathname}?${params.toString()}`, { scroll: false }),
    )
  }
  useEffect(() => {
    updateSearch({ type: "url", value: urlSearch })
  }, [urlSearch])
  useEffect(() => {
    const historySearch = () => {
      const value = parseEmailReviewQueueOptions({
        reviewSearch:
          new URLSearchParams(window.location.search).get("reviewSearch") ??
          undefined,
      }).search
      updateSearch({ type: "history", value })
      clearSelection()
    }
    window.addEventListener("popstate", historySearch)
    return () => window.removeEventListener("popstate", historySearch)
  }, [])
  useEffect(() => {
    if (
      search.trim() === urlSearch ||
      searchState.submitted[search.trim()] === searchState.revision
    )
      return
    const timer = setTimeout(
      () => navigate({ reviewSearch: search.trim(), reviewPage: null }),
      300,
    )
    return () => clearTimeout(timer)
    // Navigation depends on the server query and draft input, not unrelated render state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    urlSearch,
    searchState.revision,
    searchState.submitted,
    queue.view,
    queue.purpose,
    queue.sort,
    queue.direction,
    queue.page,
  ])
  useEffect(() => {
    const request = ++batchRequest.current
    let active = true
    // Resume only reads the actor-bound saved manifest. It never prepares,
    // acknowledges, confirms or dispatches anything on reload/history navigation.
    const read = savedBatchId
      ? getStaffEmailBulk(savedBatchId)
      : Promise.resolve(null)
    read
      .then((next) => {
        if (!active || request !== batchRequest.current) return
        setBatchError("")
        if (next)
          setSavedBatchHref(`/emails/bulk/${encodeURIComponent(next.batch.id)}`)
        setBatch(next)
      })
      .catch((cause) => {
        if (active && request === batchRequest.current) {
          setBatch(null)
          setBatchError(
            cause instanceof Error
              ? cause.message
              : "The saved confirmation is unavailable.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [savedBatchId])

  function openReview(review: EmailReviewQueueRow) {
    if (!emailReviewDetailHref(review.id)) return
    const request = ++detailRequest.current
    setSelectedReview(review)
    setRecord(null)
    setDetailError("")
    startTransition(async () => {
      try {
        const next = await getStaffEmailReview(review.id)
        if (request === detailRequest.current) setRecord(next)
      } catch (cause) {
        if (request === detailRequest.current)
          setDetailError(
            cause instanceof Error
              ? cause.message
              : "This review is unavailable. Refresh the queue.",
          )
      }
    })
  }
  async function refreshReview() {
    if (selectedReview) {
      const request = ++detailRequest.current
      const next = await getStaffEmailReview(selectedReview.id)
      if (request === detailRequest.current) setRecord(next)
    }
    router.refresh()
  }
  function runRow(review: EmailReviewQueueRow) {
    startTransition(async () => {
      try {
        const result = review.archived_at
          ? await restoreStaffEmailReview(review.id, review.version)
          : await archiveStaffEmailReview(review.id, review.version)
        clearSelection()
        toast.success(result.message)
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "This draft changed. Refresh and inspect it.",
        )
      }
      router.refresh()
    })
  }
  function runSelected(
    rows: EmailReviewQueueRow[],
    transition: "archive" | "restore",
  ) {
    if (!rows.length || rows.length > 25) return
    startTransition(async () => {
      try {
        const result = await changeStaffEmailReviewArchiveSelection(
          rows.map((review) => ({ id: review.id, version: review.version })),
          transition,
        )
        setOutcomes(
          result.outcomes.map((item) => ({
            label:
              rows.find((review) => review.id === item.id)?.subject ??
              "Selected draft",
            outcome: item.outcome,
          })),
        )
        clearSelection()
        toast.message(result.message)
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Selected drafts could not be updated.",
        )
      }
      router.refresh()
    })
  }
  function prepareSend(rows: EmailReviewQueueRow[]) {
    if (!rows.length || rows.length > 5 || !rows.every(canPrepareSend)) return
    startTransition(async () => {
      try {
        const prepared = await prepareStaffEmailBulk({
          ids: rows.map((review) => ({
            id: review.id,
            version: review.version,
          })),
          page: queue.page,
          view: queue.view,
          search: queue.search,
          purpose: queue.purpose,
          sort: queue.sort,
          direction: queue.direction,
        })
        setSavedBatchHref(prepared.href)
        setBatch(null)
        const params = new URLSearchParams(searchParams.toString())
        params.set("reviewBatch", prepared.batchId)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        clearSelection()
        detailRequest.current++
        setSelectedReview(null)
        setRecord(null)
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "The selection changed. Refresh this page.",
        )
        router.refresh()
      }
    })
  }

  const columns: ColumnDef<DataGridFeatures, GridRow>[] = [
    {
      id: "select",
      size: 32,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) =>
        row.original.kind === "draft" && row.getCanSelect() ? (
          <DataGridTableRowSelect row={row} />
        ) : null,
    },
    {
      id: "message",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Message" />
      ),
      accessorFn: (row) =>
        row.kind === "draft" ? row.review.subject : row.label,
      minSize: 260,
      enableSorting: true,
      meta: { autoSize: true },
      cell: ({ row }) => {
        const item = row.original
        if (item.kind === "group")
          return (
            <div data-run-row="group" className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`${collapsed[item.id] ? "Expand" : "Collapse"} ${item.label}`}
                aria-expanded={!collapsed[item.id]}
                onClick={() => {
                  clearSelection()
                  setCollapsed((current) => ({
                    ...current,
                    [item.id]: !current[item.id],
                  }))
                }}
              >
                <ChevronDown
                  className={collapsed[item.id] ? "-rotate-90" : ""}
                />
              </Button>
              <span
                className={`size-2 rounded-full ${item.state === "sent" ? "bg-success" : item.state === "uncertain" || item.state === "failed" ? "bg-destructive" : "bg-warning"}`}
              />
              <span className="text-sm font-medium">{item.label}</span>
              <Badge variant="outline">{item.count}</Badge>
            </div>
          )
        const href = emailReviewDetailHref(item.review.id)
        return (
          <div data-run-row="draft" className="flex items-center gap-3 py-0.5">
            <div className="min-w-0">
              <div title={item.review.subject}>
                {href ? (
                  <Link
                    href={href}
                    className="block max-w-full truncate text-left text-sm font-medium leading-5 hover:underline"
                    onClick={(event) => {
                      event.preventDefault()
                      openReview(item.review)
                    }}
                  >
                    {item.review.subject}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium leading-5">
                    {item.review.subject}
                  </span>
                )}
              </div>
              <p
                className="email-message-preview mt-1 text-xs leading-5 text-muted-foreground"
                title={item.review.body_preview}
              >
                {item.review.body_preview.replace(/\s+/g, " ").trim()}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      id: "purpose",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Purpose" />
      ),
      accessorFn: (row) =>
        row.kind === "draft" ? row.review.purpose_label : "",
      enableSorting: true,
      size: 125,
      cell: ({ row }) =>
        row.original.kind === "draft" ? (
          <Badge
            variant={purposeVariant[row.original.review.purpose_key]}
            className="max-w-full truncate"
          >
            {row.original.review.purpose_label}
          </Badge>
        ) : null,
    },
    {
      id: "recipient",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Recipient" />
      ),
      accessorFn: (row) =>
        row.kind === "draft" ? row.review.recipient_name : "",
      enableSorting: true,
      size: 205,
      cell: ({ row }) =>
        row.original.kind === "draft" ? (
          <Recipient review={row.original.review} />
        ) : null,
    },
    {
      id: "company",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Company" />
      ),
      accessorFn: (row) =>
        row.kind === "draft" ? row.review.company_name : "",
      enableSorting: true,
      size: 120,
      cell: ({ row }) =>
        row.original.kind === "draft" ? (
          <div
            className="truncate text-[11px] text-muted-foreground"
            title={row.original.review.company_name ?? "Company not recorded"}
          >
            {row.original.review.company_name ?? "Not recorded"}
          </div>
        ) : null,
    },
    {
      id: "prepared",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Prepared" />
      ),
      accessorFn: (row) => (row.kind === "draft" ? row.review.created_at : ""),
      enableSorting: true,
      size: 130,
      cell: ({ row }) =>
        row.original.kind === "draft" ? (
          <time
            dateTime={row.original.review.created_at}
            title={fullPreparedAt(row.original.review.created_at)}
            className="flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
          >
            <Clock aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{preparedAt(row.original.review.created_at)}</span>
          </time>
        ) : null,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      size: 180,
      cell: ({ row }) => {
        if (row.original.kind !== "draft") return null
        const review = row.original.review
        const href = emailReviewDetailHref(review.id)
        return (
          <div className="flex justify-end gap-2">
            {href ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={href}
                  onClick={(event) => {
                    event.preventDefault()
                    openReview(review)
                  }}
                >
                  Review
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Unavailable
              </Button>
            )}
            {review.state === "sent" ? (
              <Badge variant="success-light">Accepted</Badge>
            ) : (
              <Button
                size="sm"
                disabled={pending || !canPrepareSend(review) || !href}
                onClick={() => prepareSend([review])}
              >
                <Send aria-hidden="true" className="size-3.5" />
                Send
              </Button>
            )}
            {isEmailReviewSelectable(review) && href ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`${review.archived_at ? "Restore" : "Archive"} draft for ${review.recipient_name ?? review.recipient_email}`}
                title={
                  review.archived_at
                    ? "Restore to Active backlog"
                    : "Archive draft"
                }
                disabled={pending}
                onClick={() => runRow(review)}
              >
                {review.archived_at ? (
                  <RotateCcw className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            ) : null}
            {review.namespace === "DEMO" ? (
              <span className="sr-only">
                DEMO · production sending disabled
              </span>
            ) : null}
          </div>
        )
      },
    },
  ]
  const table = useTable({
    features: dataGridFeatures,
    data,
    columns,
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    enableRowSelection: (row) =>
      row.original.kind === "draft" &&
      isEmailReviewSelectable(row.original.review) &&
      Boolean(emailReviewDetailHref(row.id)),
    state: {
      rowSelection,
      sorting: [{ id: queue.sort, desc: queue.direction === "desc" }],
    },
    onRowSelectionChange: (update) =>
      setSelection({
        pageKey,
        rows: typeof update === "function" ? update(rowSelection) : update,
      }),
    onSortingChange: (update) => {
      const current: SortingState = [
        { id: queue.sort, desc: queue.direction === "desc" },
      ]
      const next = (typeof update === "function" ? update(current) : update)[0]
      const column = (next?.id ?? queue.sort) as EmailReviewSort
      navigate({
        reviewSort: column,
        reviewDirection: next?.desc ? "desc" : "asc",
        reviewPage: null,
      })
    },
  })

  return (
    <section
      className="email-review-scope email-queue-shell"
      aria-label="Staff email review queue"
      aria-busy={pending}
    >
      <div className="email-queue-heading">
        <div>
          <h2>Review &amp; send</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the message, check the recipient, then send.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Prepared <Badge variant="secondary">{queue.allCount}</Badge>
          </span>
          <span className="border-l pl-4 text-muted-foreground">
            Active <Badge variant="warning-light">{queue.activeCount}</Badge>
          </span>
        </div>
      </div>
      <div className="email-viewbar">
        <div className="flex gap-1" aria-label="Queue views">
          <Button
            size="sm"
            variant={queue.view === "active" ? "secondary" : "ghost"}
            aria-current={queue.view === "active" ? "page" : undefined}
            onClick={() =>
              navigate({ reviewFilter: "active", reviewPage: null })
            }
          >
            Active backlog
          </Button>
          <Button
            size="sm"
            variant={queue.view === "archived" ? "secondary" : "ghost"}
            aria-current={queue.view === "archived" ? "page" : undefined}
            onClick={() =>
              navigate({ reviewFilter: "archived", reviewPage: null })
            }
          >
            <Archive className="size-3.5" />
            Archived <Badge variant="outline">{queue.archivedCount}</Badge>
          </Button>
          <Button
            size="sm"
            variant={queue.view === "all" ? "secondary" : "ghost"}
            aria-current={queue.view === "all" ? "page" : undefined}
            onClick={() => navigate({ reviewFilter: "all", reviewPage: null })}
          >
            All history
          </Button>
        </div>
        <span>{queue.allCount} prepared emails</span>
      </div>
      <div className="email-toolbar">
        <form
          className="email-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            navigate({ reviewSearch: search.trim(), reviewPage: null })
          }}
        >
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
          <Input
            aria-label="Search drafts"
            placeholder="Search recipient, subject or opportunity…"
            maxLength={120}
            value={search}
            onChange={(event) => {
              clearSelection()
              updateSearch({ type: "typed", value: event.target.value })
              clearSelection()
            }}
          />
        </form>
        <Select
          value={queue.purpose}
          onValueChange={(value) =>
            navigate({
              reviewPurpose: value === "all" ? null : value,
              reviewPage: null,
            })
          }
        >
          <SelectTrigger
            aria-label="Filter by email purpose"
            className="min-w-48"
          >
            <Filter className="size-4 text-muted-foreground" />
            <SelectValue>
              {queue.purpose === "all"
                ? "All purposes"
                : EMAIL_REVIEW_PURPOSES.find(
                    (purpose) => purpose.key === queue.purpose,
                  )?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" className="email-review-scope min-w-56">
            <SelectItem value="all">All purposes</SelectItem>
            {EMAIL_REVIEW_PURPOSES.map((purpose) => {
              const Icon = purposeIcons[purpose.key]
              return (
                <SelectItem key={purpose.key} value={purpose.key}>
                  <Icon
                    aria-hidden="true"
                    className={`size-4 ${purposeIconColors[purpose.key]}`}
                  />
                  {purpose.label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal />
              Display
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="email-review-scope w-56">
            <div className="mb-3 font-medium">Row density</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={dense ? "default" : "outline"}
                onClick={() => setDense(true)}
              >
                Compact
              </Button>
              <Button
                size="sm"
                variant={!dense ? "default" : "outline"}
                onClick={() => setDense(false)}
              >
                Comfortable
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Both views keep the message preview.
            </p>
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          onClick={() => {
            clearSelection()
            setCollapsed(
              allExpanded
                ? Object.fromEntries(groups.map((group) => [group.id, true]))
                : {},
            )
          }}
        >
          {allExpanded ? "Collapse groups" : "Expand groups"}
        </Button>
      </div>
      <DataGrid
        table={table}
        recordCount={queue.reviews.length}
        emptyMessage="No drafts in this view. Try another search or purpose filter, or open All history."
        tableLayout={{
          dense,
          rowBorder: true,
          headerSticky: false,
          width: "fixed",
        }}
        tableClassNames={{
          bodyRow:
            "[&:has([data-run-row=group])>td]:bg-muted/45 [&:has([data-run-row=group])>td]:h-11",
          edgeCell: "first:ps-3 last:pe-3",
        }}
      >
        <div className="flex items-center gap-2 border-y px-3 py-3 text-xs text-muted-foreground">
          <DataGridTableRowSelectAll />
          <span>
            Select all visible
            {queue.search || queue.purpose !== "all" ? " matching" : ""}{" "}
            eligible drafts on this page
          </span>
        </div>
        <DataGridContainer className="border-b">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        <DataGridSelectionBar
          label={(count) => `${count} selected on this page`}
        >
          {queue.view === "archived" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !selectedArchived.length}
              onClick={() => runSelected(selectedArchived, "restore")}
            >
              <RotateCcw />
              Restore selected
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !selectedActive.length}
                onClick={() => runSelected(selectedActive, "archive")}
              >
                <Trash2 />
                Archive selected
              </Button>
              {selectedArchived.length ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => runSelected(selectedArchived, "restore")}
                >
                  <RotateCcw />
                  Restore selected
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={pending || !canSendSelection}
                title={
                  selectedRows.length > 5
                    ? "Choose at most 5 complete messages to review for sending"
                    : !selectedRows.every(canPrepareSend)
                      ? "Sending requires only current pending REAL drafts"
                      : undefined
                }
                onClick={() => prepareSend(selectedRows)}
              >
                <Send />
                Send all selected
              </Button>
            </>
          )}
          {selectedRows.length > 5 ? (
            <span className="text-xs text-muted-foreground">
              Sending is limited to 5 messages.
            </span>
          ) : null}
        </DataGridSelectionBar>
      </DataGrid>
      <footer className="email-queue-footer">
        <span>
          {queue.reviews.length} visible of {queue.total} matching prepared
          emails
        </span>
        {queue.total > queue.pageSize ? (
          <div className="flex items-center gap-2">
            <span>
              Page {queue.page} of {Math.ceil(queue.total / queue.pageSize)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || queue.page <= 1}
              onClick={() => navigate({ reviewPage: String(queue.page - 1) })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || queue.page * queue.pageSize >= queue.total}
              onClick={() => navigate({ reviewPage: String(queue.page + 1) })}
            >
              Next
            </Button>
          </div>
        ) : (
          <span>Review before sending</span>
        )}
      </footer>
      {savedBatchHref && !batch ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link className="underline" href={savedBatchHref}>
            Reopen saved confirmation
          </Link>
        </p>
      ) : null}
      {batchError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {batchError}
        </p>
      ) : null}
      {outcomes.length ? (
        <div role="status" className="mt-4 border-t pt-3 text-sm">
          <p className="font-medium">Selected-page results</p>
          <ul className="mt-2 space-y-1">
            {outcomes.map((item, index) => (
              <li key={`${index}:${item.label}`}>
                {item.label}:{" "}
                {item.outcome === "blocked"
                  ? "Changed or ineligible; refresh and inspect"
                  : item.outcome}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Sheet
        open={Boolean(selectedReview)}
        onOpenChange={(open) => {
          if (!open) {
            detailRequest.current++
            setSelectedReview(null)
            setRecord(null)
          }
        }}
      >
        <SheetContent className="email-review-scope !w-full overflow-y-auto sm:!max-w-[660px]">
          <SheetHeader className="border-b p-6">
            <SheetTitle>Review message</SheetTitle>
            <SheetDescription>
              {selectedReview?.purpose_label}
              {record
                ? ` · Prepared by ${record.review.source_kind === "freshness" ? "the automated 45-day rule" : record.review.created_by}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="p-6 pt-0">
            {record ? (
              <ReviewDetail
                key={`${record.review.id}:${record.review.version}`}
                initial={record}
                recipient={selectedReview ?? undefined}
                embedded
                onUpdated={refreshReview}
                onSaved={() => {
                  detailRequest.current++
                  setSelectedReview(null)
                  setRecord(null)
                }}
                onSend={(canonical) => {
                  setSingleConfirmation(canonical)
                  detailRequest.current++
                  setSelectedReview(null)
                  setRecord(null)
                }}
              />
            ) : (
              <p
                role={detailError ? "alert" : "status"}
                className="text-sm text-muted-foreground"
              >
                {detailError || "Loading complete message…"}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={Boolean(batch)}
        onOpenChange={(open) => {
          if (!open) {
            batchRequest.current++
            setBatch(null)
            router.refresh()
          }
        }}
      >
        <DialogContent className="email-review-scope max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {batch && batch.batch.item_count > 1
                ? `Send ${batch.batch.item_count} selected emails?`
                : "Confirm send"}
            </DialogTitle>
            <DialogDescription>
              Review every complete message below before confirming delivery.
            </DialogDescription>
          </DialogHeader>
          {batch ? (
            <BulkEmailConfirmation
              key={batch.batch.id}
              initial={batch}
              embedded
              onBack={() => {
                batchRequest.current++
                setBatch(null)
                router.refresh()
              }}
            />
          ) : null}
          {savedBatchHref ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">More details</summary>
              <Link className="mt-2 block underline" href={savedBatchHref}>
                Open this saved confirmation
              </Link>
            </details>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(singleConfirmation)}
        onOpenChange={(open) => {
          if (!open) setSingleConfirmation(null)
        }}
      >
        <DialogContent className="email-review-scope max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm send</DialogTitle>
            <DialogDescription>
              Review the complete saved message below before confirming
              delivery.
            </DialogDescription>
          </DialogHeader>
          {singleConfirmation ? (
            <SingleEmailConfirmation
              key={`${singleConfirmation.review.id}:${singleConfirmation.review.version}`}
              initial={singleConfirmation}
              onBack={() => setSingleConfirmation(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
