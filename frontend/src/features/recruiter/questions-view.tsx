"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import { useRecruiterQuestions } from "@/hooks/use-recruiter-questions"

// Re-export the enhanced questions view
export { EnhancedQuestionsView as RecruiterQuestionsView } from "./questions/enhanced-questions-view"

// Legacy export for backwards compatibility
export function RecruiterQuestionsViewLegacy({ basePath = "/recruiter" }: { basePath?: string }) {
  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState<string>("all")
  const [type, setType] = useState<string>("all")
  const [page, setPage] = useState(1)
  const limit = 10

  const { data, isLoading, isError, error } = useRecruiterQuestions({
    search: search.trim() || undefined,
    difficulty: difficulty === "all" ? undefined : (difficulty as "easy" | "medium" | "hard"),
    type: type === "all" ? undefined : (type as "mcq" | "msq" | "coding"),
    page,
    limit,
  })

  const items = useMemo(() => data?.items ?? [], [data?.items])
  const pagination = data?.pagination ?? { page: 1, limit, total: items.length, pages: 1 }

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((question) => question.category).filter(Boolean))).sort()
  }, [items])

  const difficultyCounts = useMemo(() => {
    return items.reduce(
      (acc, question) => {
        acc[question.difficulty] = (acc[question.difficulty] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
  }, [items])

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-end">
        <Button asChild>
          <Link href={`${basePath}/questions/new`}>New question</Link>
        </Button>
      </div>
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load question bank</AlertTitle>
          <AlertDescription>{(error as Error)?.message ?? "Try again later."}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Question library</CardTitle>
          <CardDescription>Discover reusable questions and assign categories for faster assessment creation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Summary label="Total questions" value={`${pagination.total}`} helper="Across all types" />
          <Summary label="MCQ" value={`${items.filter((q) => q.type === "mcq").length}`} helper="Single choice" />
          <Summary label="Coding" value={`${items.filter((q) => q.type === "coding").length}`} helper="Code exercises" />
          <Summary label="Unique categories" value={`${categories.length}`} helper="Curated domains" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Manage questions</CardTitle>
            <CardDescription>Filter by difficulty or type. Use the builder to add new questions when needed.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search title, tags, or category"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="w-48"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={type}
              onChange={(event) => {
                setType(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All types</option>
              <option value="mcq">MCQ</option>
              <option value="msq">MSQ</option>
              <option value="coding">Coding</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Title</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        Loading questions…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        No questions match the selected filters.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{question.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Updated {new Date(question.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={difficultyVariant[question.difficulty] ?? "outline"} className="capitalize">
                          {question.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{question.type}</TableCell>
                      <TableCell className="capitalize">{question.category || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {question.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {question.tags.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>{question.points}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {Object.entries(difficultyCounts).map(([level, count]) => (
              <Badge key={level} variant={difficultyVariant[level] ?? "outline"}>
                {level}: {count}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.pages}
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      setPage((p) => Math.max(1, p - 1))
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, index) => {
                  const p = Math.min(Math.max(1, pagination.page - 2), Math.max(1, pagination.pages - 4)) + index
                  if (p > pagination.pages) return null
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === pagination.page}
                        onClick={(event) => {
                          event.preventDefault()
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
                    onClick={(event) => {
                      event.preventDefault()
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

function Summary({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground/80">{helper}</p>
    </div>
  )
}
