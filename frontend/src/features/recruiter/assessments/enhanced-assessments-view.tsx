"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Plus, Calendar, Filter } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { useRecruiterAssessmentsEnhanced } from "@/hooks/use-recruiter-assessments-enhanced"
import { AssessmentStatusBadge, AssessmentActions } from "./index"

export function EnhancedAssessmentsView({ basePath = "/recruiter" }: { basePath?: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [type, setType] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const limit = 10

  const { data, isLoading, isError, error } = useRecruiterAssessmentsEnhanced({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : (status as any),
    type: type === "all" ? undefined : (type as "mcq" | "coding" | "mixed"),
    page,
    limit,
  })

  const assessments = useMemo(() => data?.data?.assessments ?? [], [data])
  const pagination = useMemo(
    () =>
      data?.data?.pagination ?? {
        page: 1,
        limit,
        total: assessments.length,
        pages: 1,
      },
    [data, assessments.length, limit]
  )

  // Calculate statistics
  const stats = useMemo(() => {
    const byStatus = {
      draft: 0,
      active: 0,
      archived: 0,
      scheduled: 0,
      under_review: 0,
    }

    const byType = {
      mcq: 0,
      coding: 0,
      mixed: 0,
    }

    assessments.forEach((assessment) => {
      if (assessment.status) byStatus[assessment.status]++
      if (assessment.type) byType[assessment.type]++
    })

    const totalQuestions = assessments.reduce((sum, a) => sum + (a.questions?.length || 0), 0)
    const avgDuration = assessments.length
      ? Math.round(assessments.reduce((sum, a) => sum + (a.settings?.timeLimit || 0), 0) / assessments.length)
      : 0

    return { byStatus, byType, totalQuestions, avgDuration }
  }, [assessments])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(assessments.map((a) => a.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (assessmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, assessmentId])
    } else {
      setSelectedIds(selectedIds.filter((id) => id !== assessmentId))
    }
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assessments</h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and monitor your assessment library
          </p>
        </div>
        <Button asChild>
          <Link href={`${basePath}/assessments/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Link>
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load assessments</AlertTitle>
          <AlertDescription>{(error as Error)?.message ?? "Try again later."}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Assessments"
          value={pagination.total.toString()}
          helper="All statuses"
          icon="📋"
        />
        <StatCard
          label="Active"
          value={stats.byStatus.active.toString()}
          helper="Live for candidates"
          icon="✅"
          trend="success"
        />
        <StatCard
          label="Draft"
          value={stats.byStatus.draft.toString()}
          helper="Work in progress"
          icon="✏️"
        />
        <StatCard
          label="Avg Duration"
          value={`${stats.avgDuration}m`}
          helper="Time limit"
          icon="⏱️"
        />
      </div>

      {/* Status Distribution */}
      {pagination.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <StatusPill label="Active" count={stats.byStatus.active} variant="default" />
              <StatusPill label="Draft" count={stats.byStatus.draft} variant="secondary" />
              <StatusPill label="Scheduled" count={stats.byStatus.scheduled} variant="default" />
              <StatusPill label="Under Review" count={stats.byStatus.under_review} variant="destructive" />
              <StatusPill label="Archived" count={stats.byStatus.archived} variant="outline" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessments Table */}
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Assessment Library</CardTitle>
            <CardDescription>
              Browse, filter, and manage your assessment collection
            </CardDescription>
          </div>

          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search assessments..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Selection Toolbar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-3">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === assessments.length && assessments.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        Loading assessments...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : assessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Filter className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          No assessments match the selected filters
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            setSearch("")
                            setStatus("all")
                            setType("all")
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  assessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(assessment.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(assessment.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Link
                            href={`${basePath}/assessments/${assessment.id}`}
                            className="font-medium hover:underline"
                          >
                            {assessment.title}
                          </Link>
                          {assessment.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {assessment.description}
                            </span>
                          )}
                          {assessment.tags && assessment.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {assessment.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {assessment.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{assessment.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AssessmentStatusBadge status={assessment.status} />
                        {assessment.scheduledStartDate && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(assessment.scheduledStartDate).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{assessment.type}</TableCell>
                      <TableCell>{assessment.questions?.length || 0}</TableCell>
                      <TableCell>{assessment.settings?.timeLimit || 0} min</TableCell>
                      <TableCell>
                        <Badge variant={assessment.isPublished ? "default" : "outline"}>
                          {assessment.isPublished ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AssessmentActions
                          assessmentId={assessment.id}
                          assessmentTitle={assessment.title}
                          isPublished={assessment.isPublished}
                          status={assessment.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing {assessments.length} of {pagination.total} assessments (Page {pagination.page} of{" "}
              {pagination.pages})
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setPage((p) => Math.max(1, p - 1))
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, index) => {
                  const p =
                    Math.min(Math.max(1, pagination.page - 2), Math.max(1, pagination.pages - 4)) + index
                  if (p > pagination.pages) return null
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === pagination.page}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(p)
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setPage((p) => Math.min(pagination.pages, p + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  helper,
  icon,
  trend,
}: {
  label: string
  value: string
  helper: string
  icon?: string
  trend?: "success" | "warning" | "neutral"
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{helper}</p>
          </div>
          {icon && <span className="text-2xl">{icon}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusPill({
  label,
  count,
  variant,
}: {
  label: string
  count: number
  variant: "default" | "secondary" | "outline" | "destructive"
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      <span className="text-sm font-medium">{count}</span>
    </div>
  )
}
