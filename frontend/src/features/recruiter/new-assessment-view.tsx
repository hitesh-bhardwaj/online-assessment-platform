"use client"

import Link from "next/link"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, type Control, type Path, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowDown, ArrowUp, Loader2, Trash2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable, TablePagination, type DataTableColumn } from "@/components/shared"
import { InlineToast } from "@/components/ui/inline-toast"
import { useCreateRecruiterAssessment } from "@/hooks/use-recruiter-assessment"
import { useRecruiterQuestions, type QuestionRecord } from "@/hooks/use-recruiter-questions"
import { Checkbox } from "@/components/ui/checkbox"

const metadataSchema = z.object({
  title: z.string().min(4, "Title is required"),
  description: z.string().max(1000).optional(),
  type: z.union([z.literal("mcq"), z.literal("coding"), z.literal("mixed")]),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  jobRole: z.string().max(100).optional(),
})

const settingsSchema = z.object({
  timeLimit: z.coerce.number().min(5).max(480),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  allowReviewAnswers: z.boolean(),
  showResultsToCandidate: z.boolean(),
  autoSubmitOnTimeUp: z.boolean(),
  passingScore: z.coerce.number().min(0).max(100).optional(),
  attemptsAllowed: z.coerce.number().min(1).max(10),
  proctoringSettings: z.object({
    enabled: z.boolean(),
    recordScreen: z.boolean(),
    recordWebcam: z.boolean(),
    detectTabSwitch: z.boolean(),
    detectCopyPaste: z.boolean(),
    detectMultipleMonitors: z.boolean(),
    allowedApps: z.array(z.string()).optional().default([]),
    blockedWebsites: z.array(z.string()).optional().default([]),
  }),
})

const schedulingSchema = z.object({
  scheduledStartDate: z.string().optional(),
  scheduledEndDate: z.string().optional(),
}).refine((data) => {
  if (data.scheduledStartDate && data.scheduledEndDate) {
    return new Date(data.scheduledStartDate) < new Date(data.scheduledEndDate)
  }
  return true
}, {
  message: "End date must be after start date",
  path: ["scheduledEndDate"],
})

const formSchema = z.object({
  metadata: metadataSchema,
  instructions: z.string().max(2000).optional(),
  settings: settingsSchema,
  scheduling: schedulingSchema,
})

const defaultValues: z.infer<typeof formSchema> = {
  metadata: {
    title: "",
    description: "",
    type: "mixed",
    tags: [],
    category: "",
    department: "",
    jobRole: "",
  },
  instructions: "",
  settings: {
    timeLimit: 60,
    shuffleQuestions: true,
    shuffleOptions: true,
    allowReviewAnswers: true,
    showResultsToCandidate: false,
    autoSubmitOnTimeUp: true,
    passingScore: 70,
    attemptsAllowed: 1,
    proctoringSettings: {
      enabled: false,
      recordScreen: false,
      recordWebcam: false,
      detectTabSwitch: true,
      detectCopyPaste: true,
      detectMultipleMonitors: false,
      allowedApps: [],
      blockedWebsites: [],
    },
  },
  scheduling: {
    scheduledStartDate: "",
    scheduledEndDate: "",
  },
}

type FormValues = z.infer<typeof formSchema>

interface SelectedQuestion {
  id: string
  title: string
  difficulty: string
  type: string
  points: number
  estimatedTimeMinutes: number
}

export function RecruiterNewAssessmentView({ basePath = "/recruiter" }: { basePath?: string }) {
  const router = useRouter()
  const createMutation = useCreateRecruiterAssessment()

  type QuestionTypeFilter = "all" | "mcq" | "msq" | "coding"
  type QuestionDifficultyFilter = "all" | "easy" | "medium" | "hard"

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<QuestionTypeFilter>("all")
  const [difficultyFilter, setDifficultyFilter] = useState<QuestionDifficultyFilter>("all")
  const [selected, setSelected] = useState<Record<string, SelectedQuestion>>({})
  const [selectedOrder, setSelectedOrder] = useState<string[]>([])
  const [bulkSelection, setBulkSelection] = useState<string[]>([])
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  const deferredSearch = React.useDeferredValue(search)
  const trimmedSearch = deferredSearch.trim()

  const { data, isLoading, isError, error, isFetching } = useRecruiterQuestions({
    page,
    limit: pageSize,
    search: trimmedSearch.length ? trimmedSearch : undefined,
    type: typeFilter === "all" ? undefined : (typeFilter as "mcq" | "msq" | "coding"),
    difficulty: difficultyFilter === "all" ? undefined : (difficultyFilter as "easy" | "medium" | "hard"),
  })
  const questions = useMemo(() => data?.items ?? [], [data])
  const totalQuestions = data?.pagination.total ?? 0
  const totalPages = data?.pagination.pages ?? 1

  useEffect(() => {
    setPage(1)
    setBulkSelection([])
  }, [trimmedSearch, typeFilter, difficultyFilter])

  useEffect(() => {
    setBulkSelection([])
  }, [page, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages === 0 ? 1 : totalPages)
    }
  }, [page, totalPages])

  const loadingQuestions = isLoading || isFetching

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues,
    mode: "onChange",
  })
  const proctoringEnabled = form.watch("settings.proctoringSettings.enabled")

  useEffect(() => {
    if (createMutation.isSuccess) {
      setSubmissionError(null)
      router.push(`${basePath}/assessments`)
    }
  }, [basePath, createMutation.isSuccess, router])

  const handleToggleQuestion = useCallback((question: QuestionRecord) => {
    const { id, title, difficulty, type, estimatedTimeMinutes, points } = question
    setSelected((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return {
        ...prev,
        [id]: {
          id,
          title,
          difficulty,
          type,
          points: points ?? 1,
          estimatedTimeMinutes: estimatedTimeMinutes ?? 2,
        },
      }
    })
    setSelectedOrder((prev) =>
      prev.includes(id) ? prev.filter((existingId) => existingId !== id) : [...prev, id]
    )
    setBulkSelection((prev) => prev.filter((existingId) => existingId !== id))
  }, [])

  const handlePointsChange = useCallback((questionId: string, points: number) => {
    const safePoints = Number.isFinite(points) ? Math.min(Math.max(Math.round(points), 1), 50) : 1
    setSelected((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        points: safePoints,
      },
    }))
  }, [])

  const handleRemoveSelected = useCallback((questionId: string) => {
    setSelected((prev) => {
      if (!prev[questionId]) return prev
      const next = { ...prev }
      delete next[questionId]
      return next
    })
    setSelectedOrder((prev) => prev.filter((id) => id !== questionId))
    setBulkSelection((prev) => prev.filter((id) => id !== questionId))
  }, [])

  const moveSelected = useCallback((questionId: string, direction: "up" | "down") => {
    setSelectedOrder((prev) => {
      const index = prev.indexOf(questionId)
      if (index === -1) return prev
      const newOrder = [...prev]
      const swapWith = direction === "up" ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= newOrder.length) return prev
      ;[newOrder[index], newOrder[swapWith]] = [newOrder[swapWith], newOrder[index]]
      return newOrder
    })
  }, [])

  const toggleBulkSelection = useCallback((questionId: string, checked: boolean) => {
    setBulkSelection((prev) => {
      if (checked) {
        if (prev.includes(questionId)) return prev
        return [...prev, questionId]
      }
      return prev.filter((id) => id !== questionId)
    })
  }, [])

  const toggleBulkSelectCurrentPage = useCallback((checked: boolean) => {
    setBulkSelection((prev) => {
      const pageIds = questions.map((question) => question.id)
      if (checked) {
        const merged = new Set([...prev, ...pageIds])
        return Array.from(merged)
      }
      return prev.filter((id) => !pageIds.includes(id))
    })
  }, [questions])

  const handleBulkAdd = useCallback(() => {
    if (!bulkSelection.length) return
    questions.forEach((question) => {
      if (bulkSelection.includes(question.id) && !selected[question.id]) {
        handleToggleQuestion(question)
      }
    })
    setBulkSelection([])
  }, [bulkSelection, questions, selected, handleToggleQuestion])

  const handleBulkRemove = useCallback(() => {
    if (!bulkSelection.length) return
    bulkSelection.forEach((id) => {
      if (selected[id]) {
        handleRemoveSelected(id)
      }
    })
    setBulkSelection([])
  }, [bulkSelection, handleRemoveSelected, selected])

  const questionColumns = useMemo<DataTableColumn<QuestionRecord>[]>(() => {
    const pageIds = questions.map((question) => question.id)
    const selectedOnPage = pageIds.filter((id) => bulkSelection.includes(id)).length
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
            aria-label="Select all questions on page"
            checked={headerCheckboxState}
            onCheckedChange={(checked) => toggleBulkSelectCurrentPage(checked === true)}
          />
        ),
        cell: (row) => (
          <Checkbox
            aria-label={`Select question ${row.title}`}
            checked={bulkSelection.includes(row.id)}
            onCheckedChange={(checked) => toggleBulkSelection(row.id, checked === true)}
          />
        ),
        className: "w-[48px]",
        headerClassName: "w-[48px]",
      },
      {
        key: "question",
        header: "Question",
        cell: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{row.title}</span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {row.category ? <span>{row.category}</span> : null}
            </div>
          </div>
        ),
        className: "align-top",
      },
      {
        key: "difficulty",
        header: "Difficulty",
        cell: (row) => (
          <Badge variant="outline" className="capitalize">
            {row.difficulty}
          </Badge>
        ),
        className: "w-[120px]",
      },
      {
        key: "type",
        header: "Type",
        cell: (row) => <span className="capitalize">{row.type}</span>,
        className: "w-[120px]",
      },
      {
        key: "points",
        header: "Points",
        cell: (row) => <span>{row.points ?? 1}</span>,
        className: "w-[90px] text-right",
        headerClassName: "text-right",
      },
      {
        key: "actions",
        header: <span className="sr-only">Include</span>,
        headerClassName: "text-right",
        className: "w-[120px] text-right",
        cell: (row) => {
          const isSelected = Boolean(selected[row.id])
          return (
            <Button
              type="button"
              variant={isSelected ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleToggleQuestion(row)}
            >
              {isSelected ? "Remove" : "Add"}
            </Button>
          )
        },
      },
    ]
  }, [bulkSelection, handleToggleQuestion, selected, toggleBulkSelectCurrentPage, toggleBulkSelection, questions])

  const selectedList = useMemo(() => {
    return selectedOrder
      .map((id) => selected[id])
      .filter((item): item is SelectedQuestion => Boolean(item))
  }, [selected, selectedOrder])

  const selectedSummary = useMemo(() => {
    const totalQuestions = selectedList.length
    const totalPoints = selectedList.reduce((sum, item) => sum + (item.points ?? 0), 0)
    const totalDuration = selectedList.reduce((sum, item) => sum + (item.estimatedTimeMinutes ?? 0), 0)
    return {
      totalQuestions,
      totalPoints,
      totalDuration,
    }
  }, [selectedList])

  const totalPoints = selectedSummary.totalPoints
  const canSubmit = selectedSummary.totalQuestions > 0 && !createMutation.isPending && !createMutation.isSuccess

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmissionError(null)
    if (Object.keys(selected).length === 0) {
      form.setError("metadata.title", { type: "manual", message: "Select at least one question" })
      return
    }

    const passingScore = values.settings.passingScore
    if (totalPoints > 0 && typeof passingScore === "number" && passingScore > totalPoints) {
      form.setError("settings.passingScore", {
        type: "manual",
        message: "Passing score exceeds total achievable points",
      })
      return
    }

    const payload = {
      title: values.metadata.title,
      description: values.metadata.description,
      type: values.metadata.type,
      tags: values.metadata.tags || [],
      category: values.metadata.category,
      department: values.metadata.department,
      jobRole: values.metadata.jobRole,
      instructions: values.instructions,
      settings: {
        ...values.settings,
      },
      scheduledStartDate: values.scheduling.scheduledStartDate ? new Date(values.scheduling.scheduledStartDate).toISOString() : undefined,
      scheduledEndDate: values.scheduling.scheduledEndDate ? new Date(values.scheduling.scheduledEndDate).toISOString() : undefined,
      questions: selectedList.map((item, index) => ({
        questionId: item.id,
        order: index + 1,
        points: item.points,
      })),
    }

    try {
      await createMutation.mutateAsync(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create assessment"
      setSubmissionError(message)
    }
  })

  return (
    <Form {...form}>
      <form className="grid gap-6" onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Assessment details</CardTitle>
          <CardDescription>Define the basics candidates will see before they begin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="metadata.title"
              rules={{ required: "Title is required" }}
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      id="title"
                      placeholder="Senior Backend Engineer"
                      disabled={createMutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="metadata.type"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Assessment type</FormLabel>
                <FormControl>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    disabled={createMutation.isPending}
                    {...field}
                  >
                    <option value="mixed">Mixed</option>
                    <option value="mcq">MCQ only</option>
                    <option value="coding">Coding</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metadata.description"
            render={({ field }) => (
              <FormItem className="md:col-span-2 space-y-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Share the role, expectations, and preparation tips."
                    rows={3}
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="instructions"
            render={({ field }) => (
              <FormItem className="md:col-span-2 space-y-2">
                <FormLabel>Candidate instructions</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Let candidates know how the assessment works, what materials are allowed, etc."
                    rows={5}
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metadata.category"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Category (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Technical, Behavioral"
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metadata.department"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Department (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Engineering, Sales"
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metadata.jobRole"
            render={({ field }) => (
              <FormItem className="md:col-span-2 space-y-2">
                <FormLabel>Job Role (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Senior Backend Engineer, Marketing Manager"
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="metadata.tags"
            render={({ field }) => (
              <FormItem className="md:col-span-2 space-y-2">
                <FormLabel>Tags (optional)</FormLabel>
                <FormControl>
                  <TagInput
                    value={field.value || []}
                    onChange={field.onChange}
                    disabled={createMutation.isPending}
                    placeholder="Add tags (press Enter)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question bank</CardTitle>
          <CardDescription>Select questions to include in this assessment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>Questions unavailable</AlertTitle>
              <AlertDescription>
                {(error as Error | undefined)?.message ?? "Confirm the recruiter questions endpoint is reachable."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder="Search questions…"
              className="w-full md:max-w-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as QuestionTypeFilter)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="mcq">MCQ</SelectItem>
                  <SelectItem value="msq">MSQ</SelectItem>
                  <SelectItem value="coding">Coding</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={difficultyFilter}
                onValueChange={(value) => setDifficultyFilter(value as QuestionDifficultyFilter)}
              >
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Button asChild variant="link" size="sm" className="px-2">
                <Link href={`${basePath}/questions/new`}>New question</Link>
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={bulkSelection.length === 0}
                  onClick={handleBulkAdd}
                >
                  Add selected ({bulkSelection.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!bulkSelection.some((id) => selected[id])}
                  onClick={handleBulkRemove}
                >
                  Remove selected
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 md:grid-cols-3">
            <SummaryTile label="Selected" value={selectedSummary.totalQuestions} helper="questions" />
            <SummaryTile label="Total points" value={selectedSummary.totalPoints} helper="scored" />
            <SummaryTile
              label="Estimated time"
              value={selectedSummary.totalDuration}
              helper="minutes"
            />
          </div>

          {selectedSummary.totalQuestions === 0 ? (
            <InlineToast
              variant="default"
              title="Select questions to continue"
              description="Choose at least one question from the table before creating the assessment."
            />
          ) : null}

          {submissionError ? (
            <InlineToast
              variant="destructive"
              title="Assessment not saved"
              description={submissionError}
              onDismiss={() => setSubmissionError(null)}
            />
          ) : null}

          <DataTable
            columns={questionColumns}
            data={questions}
            loading={loadingQuestions}
            emptyMessage={
              trimmedSearch || typeFilter !== "all" || difficultyFilter !== "all"
                ? "No questions match the current filters."
                : "No questions available yet. Create a question to begin."
            }
            rowKey={(row) => row.id}
            rowClassName={(row) =>
              selected[row.id] ? "bg-primary/5" : bulkSelection.includes(row.id) ? "bg-muted/40" : undefined
            }
            skeletonRowCount={pageSize}
          />

          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={totalQuestions}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value)
              setPage(1)
            }}
            disabled={loadingQuestions}
          />

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="py-6 text-sm text-muted-foreground">No questions selected yet.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedList.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{index + 1}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span>{item.title}</span>
                      </TableCell>
                      <TableCell className="capitalize">{item.difficulty}</TableCell>
                      <TableCell className="capitalize">{item.type}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={item.points ?? 1}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            handlePointsChange(item.id, Number.isNaN(next) ? 1 : next)
                          }}
                          className="mx-auto h-8 w-24 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveSelected(item.id, "up")}
                            disabled={index === 0}
                          >
                            <ArrowUp className="size-4" />
                            <span className="sr-only">Move up</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveSelected(item.id, "down")}
                            disabled={index === selectedList.length - 1}
                          >
                            <ArrowDown className="size-4" />
                            <span className="sr-only">Move down</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveSelected(item.id)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Remove question</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment settings</CardTitle>
          <CardDescription>Configure candidate experience, attempts, and proctoring preferences.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <SettingsField
              control={form.control}
              name="settings.timeLimit"
              label="Time limit"
              helper="Minutes candidates have to complete the assessment."
            >
              <Input type="number" min={5} max={480} placeholder="60" />
            </SettingsField>
            <SettingsField
              control={form.control}
              name="settings.passingScore"
              label="Passing score"
              helper={totalPoints ? `Required score (points). Total available: ${totalPoints}` : "Required score in points"}
            >
              <Input type="number" min={0} max={totalPoints || 100} placeholder={totalPoints ? String(Math.ceil(totalPoints * 0.7)) : "70"} />
            </SettingsField>
            <SettingsField
              control={form.control}
              name="settings.attemptsAllowed"
              label="Attempts allowed"
              helper="Number of retries permitted per candidate."
            >
              <Input type="number" min={1} max={10} placeholder="1" />
            </SettingsField>
          </div>
          <div className="space-y-4">
            <ToggleSetting
              control={form.control}
              name="settings.shuffleQuestions"
              label="Shuffle questions"
              description="Randomize question order for each candidate."
            />
            <ToggleSetting
              control={form.control}
              name="settings.shuffleOptions"
              label="Shuffle options"
              description="Randomize answer option order within each question."
            />
            <ToggleSetting
              control={form.control}
              name="settings.allowReviewAnswers"
              label="Allow review before submit"
              description="Let candidates revisit answers before final submission."
            />
            <ToggleSetting
              control={form.control}
              name="settings.showResultsToCandidate"
              label="Show results immediately"
              description="Reveal scores to candidates after completion."
            />
            <ToggleSetting
              control={form.control}
              name="settings.autoSubmitOnTimeUp"
              label="Auto submit on time up"
              description="Automatically submit responses when time expires."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proctoring</CardTitle>
          <CardDescription>Decide which monitoring signals you need for this assessment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <ToggleSetting
            control={form.control}
            name="settings.proctoringSettings.enabled"
            label="Enable proctoring"
            description="Collect monitoring signals for exam integrity."
          />
          <ToggleSetting
            control={form.control}
            name="settings.proctoringSettings.recordScreen"
            label="Record screen"
            description="Capture candidate screen during the assessment."
            disabled={!proctoringEnabled}
          />
          <ToggleSetting
            control={form.control}
            name="settings.proctoringSettings.recordWebcam"
            label="Record webcam"
            description="Capture webcam footage during the assessment."
            disabled={!proctoringEnabled}
          />
          <ToggleSetting
            control={form.control}
            name="settings.proctoringSettings.detectTabSwitch"
            label="Detect tab switch"
            description="Flag when a candidate switches away from the assessment tab."
            disabled={!proctoringEnabled}
          />
          <ToggleSetting
            control={form.control}
            name="settings.proctoringSettings.detectCopyPaste"
            label="Detect copy/paste"
            description="Monitor and flag copy/paste activities."
            disabled={!proctoringEnabled}
          />
          <ToggleSetting
            control={form.control}
            name="settings.proctoringSettings.detectMultipleMonitors"
            label="Detect multiple monitors"
            description="Flag usage of multiple monitors during assessment."
            disabled={!proctoringEnabled}
          />
          <FormField
            control={form.control}
            name="settings.proctoringSettings.allowedApps"
            render={({ field }) => (
              <FormItem className="md:col-span-2 space-y-2">
                <FormLabel>Allowed applications (optional)</FormLabel>
                <FormControl>
                  <MultiInput
                    value={field.value || []}
                    onChange={field.onChange}
                    disabled={!proctoringEnabled || createMutation.isPending}
                    placeholder="Add allowed app names (press Enter)"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">List applications candidates are allowed to use.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="settings.proctoringSettings.blockedWebsites"
            render={({ field }) => (
              <FormItem className="md:col-span-2 space-y-2">
                <FormLabel>Blocked websites (optional)</FormLabel>
                <FormControl>
                  <MultiInput
                    value={field.value || []}
                    onChange={field.onChange}
                    disabled={!proctoringEnabled || createMutation.isPending}
                    placeholder="Add blocked domains (press Enter)"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">List website domains that should be blocked during assessment.</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling (optional)</CardTitle>
          <CardDescription>Set specific dates when this assessment should be available.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="scheduling.scheduledStartDate"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Start date & time</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">When the assessment becomes available.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scheduling.scheduledEndDate"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>End date & time</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    disabled={createMutation.isPending}
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">When the assessment becomes unavailable.</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(`${basePath}/assessments`)} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create assessment"
          )}
        </Button>
      </div>
      </form>
    </Form>
  )
}

function SettingsField<TFieldName extends Path<FormValues>>({
  control,
  name,
  label,
  helper,
  children,
}: {
  control: Control<FormValues>
  name: TFieldName
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel>{label}</FormLabel>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
          <FormControl>{React.cloneElement(children as React.ReactElement, { ...field })}</FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function ToggleSetting<TFieldName extends Path<FormValues>>({
  control,
  name,
  label,
  description,
  disabled,
}: {
  control: Control<FormValues>
  name: TFieldName
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex flex-col">
            <FormLabel className="text-sm font-medium">{label}</FormLabel>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <FormControl>
            <Toggle pressed={field.value} onPressedChange={field.onChange} disabled={disabled}>
              {field.value ? "On" : "Off"}
            </Toggle>
          </FormControl>
        </FormItem>
      )}
    />
  )
}

function SummaryTile({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/80 bg-background px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value.toLocaleString()}</span>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </div>
  )
}

function TagInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState("")

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault()
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()])
      }
      setInputValue("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="space-y-2">
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="ml-1 rounded-full hover:bg-muted"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function MultiInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string[]
  onChange: (items: string[]) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState("")

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault()
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()])
      }
      setInputValue("")
    }
  }

  const removeItem = (itemToRemove: string) => {
    onChange(value.filter((item) => item !== itemToRemove))
  }

  return (
    <div className="space-y-2">
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {value.length > 0 && (
        <div className="flex flex-col gap-1">
          {value.map((item, index) => (
            <div key={index} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm">
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                disabled={disabled}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
