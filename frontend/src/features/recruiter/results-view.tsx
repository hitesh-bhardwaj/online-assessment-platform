"use client"

import { useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRecruiterResults } from "@/hooks/use-recruiter-results"
import { RecruiterProctoringReview } from "./proctoring-review"

const riskVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
}

const PAGE_SIZE = 10

export function RecruiterResultsView() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [reviewResultId, setReviewResultId] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  const { data, isLoading, isFetching, isError, error } = useRecruiterResults({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : (status as "in_progress" | "completed" | "auto_submitted" | "disqualified"),
    search: search.trim() || undefined,
  })

  const results = data?.items ?? []
  const pagination = data?.pagination ?? {
    page: 1,
    limit: PAGE_SIZE,
    total: results.length,
    pages: 1,
  }

  const isPageEmpty = !isLoading && results.length === 0

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return "0–0"
    const start = (pagination.page - 1) * pagination.limit + 1
    const end = start + results.length - 1
    return `${Math.min(start, pagination.total)}–${Math.max(start, Math.min(end, pagination.total))}`
  }, [pagination.limit, pagination.page, pagination.total, results.length])

  const handlePrev = () => setPage((current) => Math.max(1, current - 1))
  const handleNext = () => setPage((current) => (current < pagination.pages ? current + 1 : current))
  const handleReview = (resultId: string) => {
    setReviewResultId(resultId)
    setReviewOpen(true)
  }

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Results overview is unavailable</AlertTitle>
          <AlertDescription>
            {(error as Error | undefined)?.message ?? "Try again once the recruiter results API is healthy."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle>Results overview</CardTitle>
            <CardDescription>Review candidate performance and proctoring signals in one place.</CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by candidate or assessment…"
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
            />
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="auto_submitted">Auto submitted</SelectItem>
                <SelectItem value="disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-[30%]">Candidate</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proctoring</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        Loading results…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isPageEmpty ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                        <p>No results match the selected filters.</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStatus("all")
                            setSearch("")
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => {
                    const percentage = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0
                    return (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{result.candidate}</span>
                          </div>
                        </TableCell>
                        <TableCell>{result.assessmentTitle}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-foreground">{percentage}%</span>
                          <span className="block text-xs text-muted-foreground">
                            {result.score}/{result.total} pts
                          </span>
                        </TableCell>
                        <TableCell>{result.grade}</TableCell>
                        <TableCell className="capitalize">{result.status ?? "completed"}</TableCell>
                       <TableCell>
                         <Badge variant={riskVariant[result.proctoringFlag ?? "low"] ?? "outline"}>
                            {result.proctoringFlag ?? "clear"}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(result.submittedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReview(result.id)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Showing {rangeLabel} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={pagination.page <= 1 || isFetching}>
                Previous
              </Button>
              <span className="text-xs">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={pagination.page >= pagination.pages || isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecruiterProctoringReview
        resultId={reviewResultId}
        open={reviewOpen}
        onOpenChange={(next) => {
          setReviewOpen(next)
          if (!next) {
            setReviewResultId(null)
          }
        }}
      />
    </div>
  )
}
