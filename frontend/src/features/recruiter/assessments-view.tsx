"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Archive, Loader2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRecruiterAssessments } from "@/hooks/use-recruiter-assessments"
import type { PaginatedResponse } from "@/app/api/recruiter/helpers"
import type { AssessmentSummary } from "@/lib/recruiter-data"
import { DataTable, TablePagination, type DataTableColumn } from "@/components/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { InlineToast } from "@/components/ui/inline-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiRequest } from "@/lib/api-client"
import { recruiterKeys } from "@/lib/query-keys"
import { useToast } from "@/hooks/use-toast"

const statusVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  published: "secondary",
  draft: "outline",
  archived: "destructive",
}

type MutationSource = "bulk" | "row"

interface AssessmentActionPayload {
  ids: string[]
  source: MutationSource
  meta?: {
    assessment?: AssessmentSummary
  }
}

type ArchiveActionContext =
  | { type: "single"; assessment: AssessmentSummary }
  | { type: "bulk"; assessments: AssessmentSummary[] }

const PAGE_SIZE = 10

export function RecruiterAssessmentsView({
  basePath = "/recruiter",
  showManageLink = true,
}: {
  basePath?: string
  showManageLink?: boolean
}) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>("all")
  const [type, setType] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedMap, setSelectedMap] = useState<Record<string, AssessmentSummary>>({})
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null)
  const [recentlyUpdated, setRecentlyUpdated] = useState<
    Record<string, { status: AssessmentSummary["status"]; timestamp: number }>
  >({})
  const [archiveContext, setArchiveContext] = useState<ArchiveActionContext | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const { data, isLoading, isFetching, isError, error } = useRecruiterAssessments({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : (status as "draft" | "published" | "archived"),
    type: type === "all" ? undefined : (type as "mcq" | "coding" | "mixed"),
    search: search.trim() || undefined,
  })

  const assessments = useMemo(() => data?.items ?? [], [data])
  const updateCachedAssessments = useCallback(
    (ids: string[], status: AssessmentSummary["status"], updatedAt?: string) => {
      const nextUpdatedAt = updatedAt ?? new Date().toISOString()
      queryClient.setQueriesData(
        { queryKey: recruiterKeys.assessments(), exact: false },
        (previous: PaginatedResponse<AssessmentSummary> | undefined) => {
          if (!previous) return previous
          let mutated = false
          const items = previous.items.map((item) => {
            if (ids.includes(item.id)) {
              mutated = true
              return { ...item, status, lastUpdated: nextUpdatedAt }
            }
            return item
          })
          if (!mutated) return previous
          return { ...previous, items }
        }
      )
    },
    [queryClient]
  )
  const removeAssessmentsFromCache = useCallback(
    (ids: string[]) => {
      queryClient.setQueriesData(
        { queryKey: recruiterKeys.assessments(), exact: false },
        (previous: PaginatedResponse<AssessmentSummary> | undefined) => {
          if (!previous) return previous
          let removedCount = 0
          const items = previous.items.filter((item) => {
            if (ids.includes(item.id)) {
              removedCount += 1
              return false
            }
            return true
          })
          if (removedCount === 0) return previous
          const total = Math.max(0, previous.pagination.total - removedCount)
          const limit = previous.pagination.limit
          const pages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : previous.pagination.pages
          const page = Math.min(previous.pagination.page, pages)
          return {
            ...previous,
            items,
            pagination: {
              ...previous.pagination,
              total,
              pages,
              page,
            },
          }
        }
      )
    },
    [queryClient]
  )
  const recordRecentStatus = useCallback((ids: string[], status: AssessmentSummary["status"]) => {
    setRecentlyUpdated((prev) => {
      const next = { ...prev }
      const timestamp = Date.now()
      ids.forEach((id) => {
        next[id] = { status, timestamp }
      })
      return next
    })
    ids.forEach((id) => {
      const timeoutId = setTimeout(() => {
        setRecentlyUpdated((prev) => {
          if (!prev[id]) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
      }, 4000)
      timeoutsRef.current.push(timeoutId)
    })
  }, [timeoutsRef])
  const pagination = useMemo(
    () =>
      data?.pagination ?? {
        page,
        limit: PAGE_SIZE,
        total: data?.items?.length ?? 0,
        pages: data?.pagination?.pages ?? 1,
      },
    [data, page]
  )

  const publishedCount = assessments.filter((assessment) => assessment.status === "published").length
  const draftCount = assessments.filter((assessment) => assessment.status === "draft").length
  const archivedCount = assessments.filter((assessment) => assessment.status === "archived").length
  const averageDuration = assessments.length
    ? Math.round(assessments.reduce((total, current) => total + current.durationMinutes, 0) / assessments.length)
    : 0

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      timeoutsRef.current = []
    }
  }, [])

  useEffect(() => {
    setSelectedMap((prev) => {
      if (!assessments.length) return prev
      const next = { ...prev }
      assessments.forEach((assessment) => {
        if (next[assessment.id]) {
          next[assessment.id] = assessment
        }
      })
      return next
    })
  }, [assessments])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => selectedMap[id] !== undefined || assessments.some((a) => a.id === id)))
  }, [assessments, selectedMap])

  const publishMutation = useMutation({
    mutationFn: async ({ ids }: AssessmentActionPayload) => {
      await Promise.all(
        ids.map((id) =>
          apiRequest<{ success: boolean; message: string }>({
            url: `/recruiter/assessments/${id}/publish`,
            method: "POST",
          })
        )
      )
    },
    onMutate: ({ source }: AssessmentActionPayload) => {
      if (source === "bulk") {
        setBulkError(null)
        setBulkSuccess(null)
      }
    },
    onSuccess: (_, variables) => {
      const { ids, source, meta } = variables
      const updatedAt = new Date().toISOString()
      updateCachedAssessments(ids, "published", updatedAt)
      recordRecentStatus(ids, "published")
      setSelectedMap((prev) => {
        const next = { ...prev }
        ids.forEach((id) => {
          if (next[id]) {
            next[id] = { ...next[id], status: "published", lastUpdated: updatedAt }
          }
        })
        return next
      })
      const successMessage =
        ids.length === 1 && meta?.assessment
          ? `“${meta.assessment.title}” is now live.`
          : `${ids.length} assessment${ids.length === 1 ? "" : "s"} published successfully`
      if (source === "bulk") {
        setBulkSuccess(successMessage)
      }
      showToast({
        title: "Publish complete",
        description: successMessage,
        variant: "success",
      })
      queryClient.invalidateQueries({ queryKey: recruiterKeys.assessments(), exact: false })
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : "Unable to publish selected assessments"
      if (variables.source === "bulk") {
        setBulkError(message)
      }
      showToast({
        title: "Publish failed",
        description: message,
        variant: "destructive",
      })
    },
  })

  const unpublishMutation = useMutation({
    mutationFn: async ({ ids }: AssessmentActionPayload) => {
      await Promise.all(
        ids.map((id) =>
          apiRequest<{ success: boolean; message: string }>({
            url: `/recruiter/assessments/${id}/unpublish`,
            method: "POST",
          })
        )
      )
    },
    onMutate: ({ source }: AssessmentActionPayload) => {
      if (source === "bulk") {
        setBulkError(null)
        setBulkSuccess(null)
      }
    },
    onSuccess: (_, variables) => {
      const { ids, source, meta } = variables
      const updatedAt = new Date().toISOString()
      updateCachedAssessments(ids, "draft", updatedAt)
      recordRecentStatus(ids, "draft")
      setSelectedMap((prev) => {
        const next = { ...prev }
        ids.forEach((id) => {
          if (next[id]) {
            next[id] = { ...next[id], status: "draft", lastUpdated: updatedAt }
          }
        })
        return next
      })
      const successMessage =
        ids.length === 1 && meta?.assessment
          ? `“${meta.assessment.title}” is now in draft.`
          : `${ids.length} assessment${ids.length === 1 ? "" : "s"} moved to draft`
      if (source === "bulk") {
        setBulkSuccess(successMessage)
      }
      showToast({
        title: "Status updated",
        description: successMessage,
        variant: "success",
      })
      queryClient.invalidateQueries({ queryKey: recruiterKeys.assessments(), exact: false })
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : "Unable to update selected assessments"
      if (variables.source === "bulk") {
        setBulkError(message)
      }
      showToast({
        title: "Unpublish failed",
        description: message,
        variant: "destructive",
      })
    },
  })
  const archiveMutation = useMutation({
    mutationFn: async ({ ids }: AssessmentActionPayload) => {
      await Promise.all(
        ids.map((id) =>
          apiRequest<{ success: boolean; message: string }>({
            url: `/recruiter/assessments/${id}`,
            method: "DELETE",
          })
        )
      )
    },
    onMutate: ({ source }: AssessmentActionPayload) => {
      if (source === "bulk") {
        setBulkError(null)
        setBulkSuccess(null)
      }
    },
    onSuccess: (_, variables) => {
      const { ids, source, meta } = variables
      removeAssessmentsFromCache(ids)
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
      setSelectedMap((prev) => {
        const next = { ...prev }
        ids.forEach((id) => {
          if (next[id]) {
            delete next[id]
          }
        })
        return next
      })
      setRecentlyUpdated((prev) => {
        const next = { ...prev }
        ids.forEach((id) => {
          if (next[id]) {
            delete next[id]
          }
        })
        return next
      })
      const successMessage =
        ids.length === 1 && meta?.assessment
          ? `“${meta.assessment.title}” was archived.`
          : `${ids.length} assessment${ids.length === 1 ? "" : "s"} archived.`
      if (source === "bulk") {
        setBulkSuccess(successMessage)
      }
      showToast({
        title: "Assessment archived",
        description: successMessage,
        variant: "success",
      })
      queryClient.invalidateQueries({ queryKey: recruiterKeys.assessments(), exact: false })
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : "Unable to archive selected assessments"
      if (variables.source === "bulk") {
        setBulkError(message)
      }
      showToast({
        title: "Archive failed",
        description: message,
        variant: "destructive",
      })
    },
    onSettled: (_, __, variables) => {
      if (variables?.source === "row") {
        const targetId = variables.meta?.assessment?.id ?? variables.ids[0]
        setRowActionId((prev) => (prev === targetId ? null : prev))
      }
      setArchiveContext(null)
    },
  })

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return "0–0"
    const start = (pagination.page - 1) * pagination.limit + 1
    const end = start + assessments.length - 1
    return `${Math.min(start, pagination.total)}–${Math.max(start, Math.min(end, pagination.total))}`
  }, [assessments.length, pagination.limit, pagination.page, pagination.total])

  const pageIds = useMemo(() => assessments.map((assessment) => assessment.id), [assessments])
  const selectedList = useMemo(
    () => selectedIds.map((id) => selectedMap[id]).filter((item): item is AssessmentSummary => Boolean(item)),
    [selectedIds, selectedMap]
  )
  const publishableIds = useMemo(
    () => selectedList.filter((item) => item.status !== "published").map((item) => item.id),
    [selectedList]
  )
  const unpublishableIds = useMemo(
    () => selectedList.filter((item) => item.status === "published").map((item) => item.id),
    [selectedList]
  )

  const handlePublishSelected = useCallback(() => {
    if (!publishableIds.length || publishMutation.isPending) return
    publishMutation.mutate({ ids: publishableIds, source: "bulk" })
  }, [publishMutation, publishableIds])

  const handleUnpublishSelected = useCallback(() => {
    if (!unpublishableIds.length || unpublishMutation.isPending) return
    unpublishMutation.mutate({ ids: unpublishableIds, source: "bulk" })
  }, [unpublishMutation, unpublishableIds])

  const handleToggleStatus = useCallback(
    (assessment: AssessmentSummary, nextChecked: boolean) => {
      if (assessment.status === "archived") return
      if (publishMutation.isPending || unpublishMutation.isPending || archiveMutation.isPending) return
      const currentlyPublished = assessment.status === "published"
      if (nextChecked === currentlyPublished) return
      const mutation = nextChecked ? publishMutation : unpublishMutation
      setRowActionId(assessment.id)
      mutation.mutate(
        { ids: [assessment.id], source: "row", meta: { assessment } },
        {
          onSettled: () => {
            setRowActionId((prev) => (prev === assessment.id ? null : prev))
          },
        }
      )
    },
    [archiveMutation.isPending, publishMutation, unpublishMutation]
  )

  const handleConfirmArchive = useCallback(() => {
    if (!archiveContext || archiveMutation.isPending) return
    if (archiveContext.type === "single") {
      const { assessment } = archiveContext
      setRowActionId(assessment.id)
      archiveMutation.mutate({ ids: [assessment.id], source: "row", meta: { assessment } })
      return
    }

    const ids = archiveContext.assessments.map((assessment) => assessment.id)
    if (ids.length === 0) {
      setArchiveContext(null)
      return
    }
    archiveMutation.mutate({ ids, source: "bulk" })
  }, [archiveContext, archiveMutation])

  const isActionPending = publishMutation.isPending || unpublishMutation.isPending || archiveMutation.isPending

  const toggleSelectOne = useCallback((id: string, checked: boolean) => {
    setBulkError(null)
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev
        return [...prev, id]
      }
      return prev.filter((existingId) => existingId !== id)
    })
    setSelectedMap((prev) => {
      const assessment = assessments.find((item) => item.id === id)
      if (!assessment) return prev
      if (checked) {
        return { ...prev, [id]: assessment }
      }
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [assessments])

  const toggleSelectPage = useCallback((checked: boolean) => {
    setBulkError(null)
    setSelectedIds((prev) => {
      if (!checked) {
        return prev.filter((id) => !pageIds.includes(id))
      }
      const merged = new Set([...prev, ...pageIds])
      return Array.from(merged)
    })
    setSelectedMap((prev) => {
      if (!checked) return prev
      const next = { ...prev }
      assessments.forEach((assessment) => {
        next[assessment.id] = assessment
      })
      return next
    })
  }, [assessments, pageIds])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setSelectedMap({})
  }, [])

  const columns = useMemo<DataTableColumn<AssessmentSummary>[]>(() => {
    const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id)).length
    const headerCheckboxState = pageIds.length === 0
      ? false
      : selectedOnPage === pageIds.length
        ? true
        : selectedOnPage > 0
          ? "indeterminate"
          : false

    return [
      {
        key: "select",
        header: (
          <Checkbox
            aria-label="Select all assessments on this page"
            checked={headerCheckboxState}
            onCheckedChange={(checked) => toggleSelectPage(checked === true)}
          />
        ),
        cell: (row) => (
          <Checkbox
            aria-label={`Select ${row.title}`}
            checked={selectedIds.includes(row.id)}
            onCheckedChange={(checked) => toggleSelectOne(row.id, checked === true)}
          />
        ),
        className: "w-[48px]",
        headerClassName: "w-[48px]",
      },
      {
        key: "title",
        header: "Assessment",
        cell: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{row.title}</span>
            <span className="text-xs text-muted-foreground">
              {row.lastUpdated ? `Updated ${new Date(row.lastUpdated).toLocaleDateString()}` : "—"}
            </span>
          </div>
        ),
        className: "w-[40%] align-top",
      },
      {
        key: "type",
        header: "Type",
        cell: (row) => <span className="capitalize">{row.type}</span>,
        className: "w-[120px]",
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => {
          const recent = recentlyUpdated[row.id]
          const message =
            recent?.status === "published"
              ? "Published just now"
              : recent?.status === "draft"
                ? "Moved to draft"
                : null
          const messageTone =
            recent?.status === "published" ? "text-emerald-600" : "text-amber-600"
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant={statusVariant[row.status] ?? "outline"} className="capitalize">
                {row.status}
              </Badge>
              {message ? (
                <span className={`text-xs font-medium ${messageTone}`}>{message}</span>
              ) : null}
            </div>
          )
        },
        className: "w-[150px]",
      },
      {
        key: "questions",
        header: "Questions",
        cell: (row) => <span>{row.questions}</span>,
        className: "w-[110px] text-right",
        headerClassName: "text-right",
      },
      {
        key: "duration",
        header: "Duration",
        cell: (row) => <span>{row.durationMinutes} min</span>,
        className: "w-[110px] text-right",
        headerClassName: "text-right",
      },
      {
        key: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "w-[220px] text-right",
        cell: (row) => {
          const isPublished = row.status === "published"
          const isArchived = row.status === "archived"
          const isBusy = rowActionId === row.id && isActionPending
          const disableToggle = isArchived || isActionPending

          return (
            <div className="flex items-center justify-end gap-3">
              {showManageLink ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${basePath}/assessments/${row.id}`}>Manage</Link>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled>
                  Manage
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isActionPending || isArchived}
                onClick={() => setArchiveContext({ type: "single", assessment: row })}
              >
                <Archive className="mr-1 h-4 w-4" /> Archive
              </Button>
              <div className="flex items-center gap-2">
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                <Switch
                  aria-label={isPublished ? `Unpublish ${row.title}` : `Publish ${row.title}`}
                  checked={isPublished}
                  disabled={disableToggle}
                  onCheckedChange={(checked) => handleToggleStatus(row, checked)}
                />
                <span className="text-xs text-muted-foreground">{isPublished ? "Live" : "Draft"}</span>
              </div>
            </div>
          )
        },
      },
    ]
  }, [
    basePath,
    handleToggleStatus,
    isActionPending,
    pageIds,
    recentlyUpdated,
    rowActionId,
    selectedIds,
    showManageLink,
    toggleSelectOne,
    toggleSelectPage,
  ])

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn&apos;t load the assessments catalog</AlertTitle>
          <AlertDescription>
            {(error as Error | undefined)?.message ?? "Double-check that the recruiter assessments API is available."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assessment health</CardTitle>
          <CardDescription>Snapshot of live, draft, and archived assessments.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="Published" value={`${publishedCount}`} helper="Live for candidates" />
          <SummaryMetric label="Drafts" value={`${draftCount}`} helper="Work in progress" />
          <SummaryMetric label="Archived" value={`${archivedCount}`} helper="Parked or inactive" />
          <SummaryMetric label="Avg. duration" value={`${averageDuration} min`} helper="Across listed assessments" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle>Assessment catalog</CardTitle>
            <CardDescription>
              Search, filter, and paginate assessments served directly from the recruiter API.
            </CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by title…"
                value={search}
                onChange={(event) => {
                  setPage(1)
                  setSearch(event.target.value)
                }}
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1)
                setStatus(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(value) => {
                setPage(1)
                setType(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedIds.length ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium">
                {selectedIds.length} assessment{selectedIds.length === 1 ? "" : "s"} selected
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!publishableIds.length || isActionPending}
                  onClick={handlePublishSelected}
                >
                  Publish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!unpublishableIds.length || isActionPending}
                  onClick={handleUnpublishSelected}
                >
                  Unpublish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!selectedIds.length || isActionPending}
                  onClick={() => setArchiveContext({ type: "bulk", assessments: selectedList })}
                >
                  Archive
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={isActionPending} onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          {bulkSuccess ? (
            <InlineToast
              variant="success"
              title="Status updated"
              description={bulkSuccess}
              onDismiss={() => setBulkSuccess(null)}
            />
          ) : null}
          {bulkError ? (
            <InlineToast
              variant="destructive"
              title="Action failed"
              description={bulkError}
              onDismiss={() => setBulkError(null)}
            />
          ) : null}

          <AlertDialog
            open={Boolean(archiveContext)}
            onOpenChange={(open) => {
              if (!open) {
                setArchiveContext(null)
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {archiveContext
                    ? archiveContext.type === "single"
                      ? `Archive “${archiveContext.assessment.title}”?`
                      : `Archive ${archiveContext.assessments.length} assessment${archiveContext.assessments.length === 1 ? "" : "s"}?`
                    : "Archive assessments"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {archiveContext?.type === "single"
                    ? "This removes the assessment from the catalog. Candidates won't be able to access its link."
                    : "This removes the selected assessments from the catalog. Candidates won't be able to access their links."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={archiveMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={archiveMutation.isPending}
                  onClick={handleConfirmArchive}
                >
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DataTable
            columns={columns}
            data={assessments}
            loading={isLoading || isFetching}
            skeletonRowCount={PAGE_SIZE}
            emptyMessage={
              status !== "all" || type !== "all" || search.trim() ? (
                <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                  <p>No assessments match the selected filters.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatus("all")
                      setType("all")
                      setSearch("")
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                "No assessments available yet. Create one to get started."
              )
            }
            rowKey={(row) => row.id}
            rowClassName={(row) => (selectedIds.includes(row.id) ? "bg-primary/5" : undefined)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {rangeLabel} of {pagination.total} assessment{pagination.total === 1 ? "" : "s"}
            </p>
            <TablePagination
              page={pagination.page}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={setPage}
              disabled={isFetching}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Need a new assessment?</CardTitle>
          <CardDescription>Create from scratch or reuse questions from your bank.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`${basePath}/assessments/new`}>Create assessment</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{helper}</span>
    </div>
  )
}
