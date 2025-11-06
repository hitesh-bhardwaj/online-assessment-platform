"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, PlusCircle, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, type Control, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InlineToast } from "@/components/ui/inline-toast"
import { DataTable } from "@/components/shared"
import type { DataTableColumn } from "@/components/shared/data-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { useToast } from "@/hooks/use-toast"
import { useRecruiterAssessment, useUpdateRecruiterAssessment } from "@/hooks/use-recruiter-assessment"
import { useRecruiterInvitations, useCreateRecruiterInvitation, useCancelRecruiterInvitation } from "@/hooks/use-recruiter-invitations"
import { useRecruiterResults } from "@/hooks/use-recruiter-results"
import { useRecruiterQuestions, type QuestionRecord } from "@/hooks/use-recruiter-questions"
import { apiRequest } from "@/lib/api-client"
import { recruiterKeys } from "@/lib/query-keys"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ResultSummary } from "@/lib/recruiter-data"
import {
  buildCompletionTrend,
  buildInvitationBreakdown,
  buildProctoringBreakdown,
  buildScoreTrend,
  computeScoreStats,
} from "@/lib/analytics-utils"
import { AssessmentHeader } from "./assessment-detail/components/header"
import { AssessmentOverviewTab } from "./assessment-detail/components/overview-tab"
import { AssessmentCandidatesTab, type InvitationStatusFilter } from "./assessment-detail/components/candidates-tab"
import { CandidateInviteDialog, type CandidateInviteFormValues } from "./assessment-detail/components/candidate-invite-dialog"
import {
  settingsFormSchema,
  type MetadataFormValues,
  type SettingsFormValues,
  type QuestionOutlineRow,
  type StatusVariant,
} from "./assessment-detail/types"
import {
  normalizeSettings,
  mapNormalizedToFormValues,
  createSettingsPayloadFromForm,
  createSettingsPayloadFromNormalized,
  settingsPayloadsEqual,
  clampNumber,
  questionsEqual,
  formatDateTime,
  formatStatusLabel,
  formatScorePercentage,
  computeStatus,
  invitationStatusVariant,
  resultStatusVariant,
  proctoringFlagVariant,
} from "./assessment-detail/utils"

type QuestionDraft = QuestionOutlineRow & {
  questionId: string
}

type ResultStatusFilter = "all" | NonNullable<ResultSummary["status"]>

const invitationStatusOptions: Array<{ value: InvitationStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "started", label: "Started" },
  { value: "submitted", label: "Submitted" },
  { value: "expired", label: "Expired" },
]

const resultStatusOptions: Array<{ value: ResultStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "auto_submitted", label: "Auto submitted" },
  { value: "disqualified", label: "Disqualified" },
]

const STATUS_BADGE_VARIANT: Record<StatusVariant, "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  published: "secondary",
  archived: "destructive",
}

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"]

export function RecruiterAssessmentDetailView({ basePath = "/recruiter" }: { basePath?: string }) {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const assessmentId = params?.id as string | undefined

  const { data, isLoading, isError, error, refetch, isFetching } = useRecruiterAssessment(assessmentId)
  const updateMutation = useUpdateRecruiterAssessment()

  const isMutationPending = updateMutation.isPending

  const normalizedSettings = useMemo(() => normalizeSettings(data?.settings), [data?.settings])
  const settingsFormValues = useMemo(() => mapNormalizedToFormValues(normalizedSettings), [normalizedSettings])

  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settingsFormValues,
    mode: "onChange",
  })

  useEffect(() => {
    settingsForm.reset(settingsFormValues)
  }, [settingsFormValues, settingsForm])

  const proctoringEnabled = settingsForm.watch("proctoring.enabled")
  const { isDirty: isSettingsDirty } = settingsForm.formState
  const isSettingsSubmitting = isMutationPending

  const handleSettingsSubmit = settingsForm.handleSubmit(async (values) => {
    if (!assessmentId) return

    const payloadSettings = createSettingsPayloadFromForm(values)
    const baselineSettings = createSettingsPayloadFromNormalized(normalizedSettings)

    if (settingsPayloadsEqual(payloadSettings, baselineSettings)) {
      settingsForm.reset(settingsFormValues)
      showToast({
        title: "No changes",
        description: "Update a field before saving.",
      })
      return
    }

    try {
      const updated = await updateMutation.mutateAsync({ id: assessmentId, body: { settings: payloadSettings } })
      const nextNormalized = normalizeSettings(updated.settings)
      const nextFormValues = mapNormalizedToFormValues(nextNormalized)
      settingsForm.reset(nextFormValues)
      showToast({
        title: "Settings updated",
        description: "Assessment configuration saved successfully.",
        variant: "success",
      })
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "Unable to update assessment settings"
      showToast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      })
    }
  })

  const questionRows = useMemo<QuestionOutlineRow[]>(() => {
    if (!data?.questions?.length) return []
    return data.questions
      .map((item) => ({
        id: item.questionId,
        order: item.order,
        title: item.question?.title ?? "Untitled question",
        points: item.points,
        type: item.question?.type,
        difficulty: item.question?.difficulty,
      }))
      .sort((a, b) => a.order - b.order)
  }, [data?.questions])

  const [activeTab, setActiveTab] = useState("overview")
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft[]>([])
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false)
  const [questionSearch, setQuestionSearch] = useState("")
  const [questionPage, setQuestionPage] = useState(1)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatusFilter>("all")
  const [invitationSearch, setInvitationSearch] = useState("")
  const [invitationPage, setInvitationPage] = useState(1)
  const [resendInvitationId, setResendInvitationId] = useState<string | null>(null)
  const [cancelInvitationId, setCancelInvitationId] = useState<string | null>(null)
  const [resultsStatus, setResultsStatus] = useState<ResultStatusFilter>("all")
  const [resultsSearch, setResultsSearch] = useState("")
  const [resultsPage, setResultsPage] = useState(1)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)

  const originalQuestionDraft = useMemo<QuestionDraft[]>(
    () =>
      questionRows.map((item, index) => ({
        ...item,
        questionId: item.id,
        order: index + 1,
      })),
    [questionRows]
  )

  useEffect(() => {
    setQuestionDraft(originalQuestionDraft)
  }, [originalQuestionDraft])

  const handleInvitationSearchChange = useCallback((value: string) => {
    setInvitationSearch(value)
    setInvitationPage(1)
  }, [])

  const handleInvitationStatusChange = useCallback((value: InvitationStatusFilter) => {
    setInvitationStatus(value)
    setInvitationPage(1)
  }, [])

  const handleInvitationClearFilters = useCallback(() => {
    setInvitationStatus("all")
    setInvitationSearch("")
    setInvitationPage(1)
  }, [])

  const questionFilters = useMemo(
    () => ({
      page: questionPage,
      limit: 10,
      search: questionSearch.trim() || undefined,
    }),
    [questionPage, questionSearch]
  )

  const {
    data: questionPoolData,
    isLoading: isQuestionPoolLoading,
    isFetching: isQuestionPoolFetching,
  } = useRecruiterQuestions(questionDialogOpen ? questionFilters : undefined)

  const questionPool = useMemo(() => {
    const existingIds = new Set(questionDraft.map((item) => item.questionId))
    return (questionPoolData?.items ?? []).filter((item) => !existingIds.has(item.id))
  }, [questionDraft, questionPoolData?.items])

  const isQuestionPoolLoadingState = isQuestionPoolLoading || (questionDialogOpen && isQuestionPoolFetching)
  const handleToggleQuestionSelection = useCallback((questionId: string, checked: boolean) => {
    setSelectedQuestionIds((prev) => {
      if (checked) {
        if (prev.includes(questionId)) return prev
        return [...prev, questionId]
      }
      return prev.filter((id) => id !== questionId)
    })
  }, [])

  const invitationFilters = useMemo(
    () => ({
      assessmentId,
      page: invitationPage,
      limit: 10,
      status: invitationStatus === "all" ? undefined : invitationStatus,
      search: invitationSearch.trim() || undefined,
    }),
    [assessmentId, invitationPage, invitationSearch, invitationStatus]
  )

  const {
    data: invitationsData,
    isLoading: isInvitationsLoading,
    isFetching: isInvitationsFetching,
    refetch: refetchInvitations,
  } = useRecruiterInvitations(invitationFilters)

  const invitations = useMemo(() => invitationsData?.items ?? [], [invitationsData?.items])
  const invitationPagination = invitationsData?.pagination
  const isInvitationsLoadingState = isInvitationsLoading || isInvitationsFetching

  const resultsFilters = useMemo(
    () => ({
      assessmentId,
      page: resultsPage,
      limit: 10,
      status: resultsStatus === "all" ? undefined : resultsStatus,
      search: resultsSearch.trim() || undefined,
    }),
    [assessmentId, resultsPage, resultsSearch, resultsStatus]
  )

  const {
    data: resultsData,
    isLoading: isResultsLoading,
    isFetching: isResultsFetching,
  } = useRecruiterResults(resultsFilters)

  const results = useMemo(() => resultsData?.items ?? [], [resultsData?.items])
  const resultsPagination = resultsData?.pagination
  const isResultsLoadingState = isResultsLoading || isResultsFetching
  const scoreTrend = useMemo(() => buildScoreTrend(results), [results])
  const completionTrendData = useMemo(() => buildCompletionTrend(results), [results])
  const invitationStatusSlices = useMemo(() => buildInvitationBreakdown(invitations), [invitations])
  const proctoringSlices = useMemo(() => buildProctoringBreakdown(results), [results])
  const scoreStats = useMemo(() => computeScoreStats(results), [results])
  const invitationStatusVariants = useMemo(() => invitationStatusVariant(), [])
  const resultStatusVariants = useMemo(() => resultStatusVariant(), [])
  const proctoringVariants = useMemo(() => proctoringFlagVariant(), [])
  const createInvitationMutation = useCreateRecruiterInvitation()
  const cancelInvitationMutation = useCancelRecruiterInvitation()

  useEffect(() => {
    if (!isInviteDialogOpen) {
      createInvitationMutation.reset()
    }
  }, [isInviteDialogOpen, createInvitationMutation])

  useEffect(() => {
    if (!cancelInvitationMutation.isPending) {
      setCancelInvitationId(null)
    }
  }, [cancelInvitationMutation.isPending])

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      setResendInvitationId(invitationId)
      return apiRequest<{ success: boolean; message?: string }>({
        url: `/recruiter/invitations/${invitationId}/resend`,
        method: "POST",
      })
    },
    onSuccess: (response) => {
      showToast({
        title: "Invitation resent",
        description: response?.message ?? "Candidate will receive a fresh invite shortly.",
        variant: "success",
      })
      refetchInvitations()
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Unable to resend invitation"
      showToast({
        title: "Resend failed",
        description: message,
        variant: "destructive",
      })
    },
    onSettled: () => {
      setResendInvitationId(null)
    },
  })

  const questionPickerColumns = useMemo<DataTableColumn<QuestionRecord>[]>(
    () => [
      {
        key: "select",
        header: (
          <Checkbox
            aria-label="Select all questions"
            checked={questionPool.length > 0 && questionPool.every((question) => selectedQuestionIds.includes(question.id))}
            onCheckedChange={(checked) => {
              setSelectedQuestionIds((prev) => {
                if (checked === true) {
                  const additions = questionPool.map((item) => item.id)
                  return Array.from(new Set([...prev, ...additions]))
                }
                const removable = new Set(questionPool.map((item) => item.id))
                return prev.filter((id) => !removable.has(id))
              })
            }}
          />
        ),
        cell: (row) => (
          <Checkbox
            aria-label={`Select question ${row.title}`}
            checked={selectedQuestionIds.includes(row.id)}
            onCheckedChange={(checked) => handleToggleQuestionSelection(row.id, checked === true)}
          />
        ),
        className: "w-[48px]",
        headerClassName: "w-[48px]",
      },
      {
        key: "title",
        header: "Question",
        cell: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{row.title}</span>
            <span className="text-xs text-muted-foreground">{row.category ?? "Uncategorized"}</span>
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        cell: (row) => <span className="capitalize">{row.type}</span>,
        className: "w-[120px]",
      },
      {
        key: "difficulty",
        header: "Difficulty",
        cell: (row) => <Badge variant="outline" className="capitalize">{row.difficulty}</Badge>,
        className: "w-[120px]",
      },
      {
        key: "points",
        header: "Points",
        cell: (row) => row.points ?? 1,
        className: "w-[80px] text-right",
        headerClassName: "text-right",
      },
    ],
    [handleToggleQuestionSelection, questionPool, selectedQuestionIds]
  )

  const status = computeStatus(data?.isPublished, data?.isActive)

  const isQuestionsSubmitting = isMutationPending
  const isQuestionsDirty = useMemo(
    () => !questionsEqual(questionDraft, originalQuestionDraft),
    [questionDraft, originalQuestionDraft]
  )

  const handleMoveQuestion = useCallback((questionId: string, direction: "up" | "down") => {
    setQuestionDraft((prev) => {
      const index = prev.findIndex((item) => item.questionId === questionId)
      if (index === -1) return prev
      const swapWith = direction === "up" ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
      return next.map((item, orderIndex) => ({ ...item, order: orderIndex + 1 }))
    })
  }, [])

  const handleRemoveQuestion = useCallback((questionId: string) => {
    setQuestionDraft((prev) =>
      prev
        .filter((item) => item.questionId !== questionId)
        .map((item, index) => ({
          ...item,
          order: index + 1,
        }))
    )
  }, [])

  const handlePointsChange = useCallback((questionId: string, nextPoints: number) => {
    setQuestionDraft((prev) =>
      prev.map((item) =>
        item.questionId === questionId
          ? { ...item, points: clampNumber(Math.round(nextPoints), 1, 50) }
          : item
      )
    )
  }, [])

  const handleAddSelectedQuestions = useCallback(() => {
    if (!selectedQuestionIds.length) return

    setQuestionDraft((prev) => {
      const existingIds = new Set(prev.map((item) => item.questionId))
      const additions = questionPool
        .filter((question) => selectedQuestionIds.includes(question.id) && !existingIds.has(question.id))
        .map<QuestionDraft>((question, index) => ({
          questionId: question.id,
          id: question.id,
          title: question.title,
          type: question.type,
          difficulty: question.difficulty,
          points: question.points ?? 1,
          order: prev.length + index + 1,
        }))

      return [...prev, ...additions].map((item, index) => ({ ...item, order: index + 1 }))
    })

    setSelectedQuestionIds([])
    setQuestionDialogOpen(false)
  }, [questionPool, selectedQuestionIds])

  const handleClearQuestionDraft = useCallback(() => {
    setQuestionDraft(originalQuestionDraft)
    setSelectedQuestionIds([])
  }, [originalQuestionDraft])

  const handleSaveQuestions = useCallback(async () => {
    if (!assessmentId || !isQuestionsDirty) return

    try {
      const payload = questionDraft.map((item, index) => ({
        questionId: item.questionId,
        order: index + 1,
        points: item.points,
      }))

      const updated = await updateMutation.mutateAsync({ id: assessmentId, body: { questions: payload } })
      const nextDraft = updated.questions
        .map((item) => ({
          questionId: item.questionId,
          id: item.questionId,
          title: item.question?.title ?? "Question",
          type: item.question?.type,
          difficulty: item.question?.difficulty,
          points: item.points,
          order: item.order,
        }))
        .sort((a, b) => a.order - b.order)

      setQuestionDraft(nextDraft)
      showToast({
        title: "Questions updated",
        description: "Assessment flow now reflects the latest question order and scoring.",
        variant: "success",
      })
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "Unable to update assessment questions"
      showToast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      })
    }
  }, [assessmentId, isQuestionsDirty, questionDraft, showToast, updateMutation])

  const questionColumns = useMemo<DataTableColumn<QuestionOutlineRow>[]>(() => {
    return [
      { key: "order", header: "#", cell: (row) => row.order, className: "w-[64px]" },
      { key: "title", header: "Question", cell: (row) => row.title },
      {
        key: "meta",
        header: "Type / Difficulty",
        cell: (row) => (
          <div className="flex flex-col text-xs text-muted-foreground">
            <span className="capitalize">{row.type ?? "—"}</span>
            <span className="capitalize">{row.difficulty ?? "—"}</span>
          </div>
        ),
        className: "w-[160px]",
      },
      {
        key: "points",
        header: "Points",
        cell: (row) => row.points,
        className: "w-[96px] text-right",
        headerClassName: "text-right",
      },
    ]
  }, [])

  const handleSaveMetadata = useCallback(
    async (values: MetadataFormValues) => {
      if (!assessmentId) return

      try {
        await updateMutation.mutateAsync({
          id: assessmentId,
          body: {
            title: values.title,
            type: values.type,
            description: values.description,
            instructions: values.instructions,
          },
        })
        showToast({
          title: "Details updated",
          description: "Assessment information saved successfully.",
          variant: "success",
        })
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Unable to update assessment details"
        showToast({
          title: "Update failed",
          description: message,
          variant: "destructive",
        })
        throw mutationError
      }
    },
    [assessmentId, showToast, updateMutation]
  )

  const handleCreateInvitation = useCallback(
    async (values: CandidateInviteFormValues) => {
      if (!assessmentId) {
        showToast({
          title: "Missing assessment",
          description: "We need an assessment ID to send an invitation.",
          variant: "destructive",
        })
        throw new Error("Missing assessment ID")
      }

      try {
        await createInvitationMutation.mutateAsync({
          assessmentId,
          candidate: {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            email: values.email.trim(),
          },
          validUntil: new Date(values.validUntil).toISOString(),
          customMessage: values.customMessage,
        })
        showToast({
          title: "Invitation sent",
          description: `${values.firstName.trim()} ${values.lastName.trim()} can now access this assessment.`,
          variant: "success",
        })
        setIsInviteDialogOpen(false)
        refetchInvitations()
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Unable to send the invitation"
        showToast({
          title: "Send failed",
          description: message,
          variant: "destructive",
        })
        throw mutationError
      }
    },
    [assessmentId, createInvitationMutation, refetchInvitations, showToast]
  )

  const handleCancelInvitation = useCallback(
    async (invitationId: string) => {
      setCancelInvitationId(invitationId)
      try {
        await cancelInvitationMutation.mutateAsync(invitationId)
        showToast({
          title: "Invitation cancelled",
          description: "The candidate will no longer be able to access this assessment.",
          variant: "default",
        })
        refetchInvitations()
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Unable to cancel the invitation"
        showToast({
          title: "Cancel failed",
          description: message,
          variant: "destructive",
        })
      }
    },
    [cancelInvitationMutation, refetchInvitations, showToast]
  )

  const handlePublishToggle = async (nextState: "published" | "draft") => {
    if (!assessmentId) return
    const endpoint = nextState === "published" ? "publish" : "unpublish"
    try {
      await apiRequest<{ success: boolean; message: string }>({
        url: `/recruiter/assessments/${assessmentId}/${endpoint}`,
        method: "POST",
      })
      showToast({
        title: nextState === "published" ? "Assessment published" : "Assessment unpublished",
        description:
          nextState === "published"
            ? "Candidates can now access the assessment."
            : "Assessment moved back to draft.",
        variant: "success",
      })
      queryClient.invalidateQueries({ queryKey: recruiterKeys.assessments(), exact: false })
      refetch()
    } catch (publishError) {
      const message =
        publishError instanceof Error ? publishError.message : "Unable to update assessment status"
      showToast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleArchive = async () => {
    if (!assessmentId) return
    try {
      await apiRequest<{ success: boolean; message: string }>({
        url: `/recruiter/assessments/${assessmentId}`,
        method: "DELETE",
      })
      showToast({
        title: "Assessment archived",
        description: "The assessment has been removed from your catalog.",
        variant: "success",
      })
      queryClient.invalidateQueries({ queryKey: recruiterKeys.assessments(), exact: false })
      router.push(`${basePath}/assessments`)
    } catch (archiveError) {
      const message =
        archiveError instanceof Error ? archiveError.message : "Unable to archive assessment"
      showToast({
        title: "Archive failed",
        description: message,
        variant: "destructive",
      })
    }
  }

  if (!assessmentId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Missing assessment ID</AlertTitle>
        <AlertDescription>
          We couldn&apos;t determine which assessment to load. Return to the assessments catalog
          and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading assessment…
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Assessment unavailable</AlertTitle>
        <AlertDescription>
          {(error as Error | undefined)?.message ??
            "Confirm the assessment still exists or try refreshing the page."}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <InlineToast
        title="Assessment not found"
        description="It may have been archived or deleted. Head back to the catalog to continue."
        variant="destructive"
      />
    )
  }

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div className="grid gap-6">
      <AssessmentHeader
        assessment={data}
        status={status}
        basePath={basePath}
        isBusy={isFetching || updateMutation.isPending}
        onPublishToggle={handlePublishToggle}
        onArchive={handleArchive}
        onSaveMetadata={handleSaveMetadata}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 gap-2 sm:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <AssessmentOverviewTab
            assessment={data}
            statusLabel={statusLabel}
            statusVariant={STATUS_BADGE_VARIANT[status]}
            questionRows={questionRows}
            questionColumns={questionColumns}
            basePath={basePath}
          />
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Question management</CardTitle>
                <CardDescription>Reorder, re-score, and curate the assessment flow.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Dialog open={questionDialogOpen} onOpenChange={(open) => {
                  setQuestionDialogOpen(open)
                  if (!open) {
                    setSelectedQuestionIds([])
                    setQuestionSearch("")
                    setQuestionPage(1)
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="secondary" size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add questions
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Add questions from your bank</DialogTitle>
                      <DialogDescription>Select questions to append to this assessment.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                          placeholder="Search questions…"
                          value={questionSearch}
                          onChange={(event) => {
                            setQuestionSearch(event.target.value)
                            setQuestionPage(1)
                          }}
                          className="w-full sm:max-w-sm"
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedQuestionIds.length} selected
                        </span>
                      </div>
                      <DataTable<QuestionRecord>
                        columns={questionPickerColumns}
                        data={questionPool}
                        loading={isQuestionPoolLoadingState}
                        emptyMessage={questionSearch.trim() ? "No questions match the current filters." : "All available questions are already included."}
                        rowKey={(row) => row.id}
                        rowClassName={(row) =>
                          selectedQuestionIds.includes(row.id) ? "bg-primary/5" : undefined
                        }
                      />
                      {questionPoolData?.pagination ? (
                        <TablePagination
                          page={questionPoolData.pagination.page}
                          pageSize={questionPoolData.pagination.limit}
                          totalItems={questionPoolData.pagination.total}
                          onPageChange={setQuestionPage}
                          disabled={isQuestionPoolLoadingState}
                        />
                      ) : null}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedQuestionIds([])}
                          disabled={selectedQuestionIds.length === 0}
                        >
                          Clear selection
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddSelectedQuestions}
                          disabled={selectedQuestionIds.length === 0}
                        >
                          Add selected ({selectedQuestionIds.length})
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isQuestionsDirty || isQuestionsSubmitting}
                  onClick={handleClearQuestionDraft}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!isQuestionsDirty || isQuestionsSubmitting}
                  onClick={handleSaveQuestions}
                >
                  {isQuestionsSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isQuestionsDirty ? (
                <InlineToast
                  variant="default"
                  title="Unsaved changes"
                  description="Save updates or discard to revert to the current live order."
                />
              ) : null}
              {questionDraft.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 py-12 text-sm text-muted-foreground">
                  No questions linked yet. Add questions from your bank to build the assessment.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[72px]">Order</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead className="w-[120px] text-right">Points</TableHead>
                        <TableHead className="w-[160px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questionDraft.map((item, index) => (
                        <TableRow key={item.questionId}>
                          <TableCell>
                            <Badge variant="outline">{index + 1}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-foreground">{item.title}</span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{item.type ?? "—"}</TableCell>
                          <TableCell className="capitalize">{item.difficulty ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={item.points}
                              disabled={isQuestionsSubmitting}
                              onChange={(event) => handlePointsChange(item.questionId, Number(event.target.value))}
                              className="ml-auto h-8 w-20 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMoveQuestion(item.questionId, "up")}
                                disabled={index === 0 || isQuestionsSubmitting}
                              >
                                <ArrowUp className="h-4 w-4" />
                                <span className="sr-only">Move up</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMoveQuestion(item.questionId, "down")}
                                disabled={index === questionDraft.length - 1 || isQuestionsSubmitting}
                              >
                                <ArrowDown className="h-4 w-4" />
                                <span className="sr-only">Move down</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleRemoveQuestion(item.questionId)}
                                disabled={isQuestionsSubmitting}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Form {...settingsForm}>
            <form className="space-y-4" onSubmit={handleSettingsSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle>Assessment settings</CardTitle>
                  <CardDescription>Adjust timing, attempts, review options, and proctoring signals.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <SettingsNumberField
                        control={settingsForm.control}
                        name="timeLimit"
                        label="Time limit"
                        helper="Minutes candidates have to complete the assessment."
                        min={5}
                        max={480}
                      />
                      <SettingsNumberField
                        control={settingsForm.control}
                        name="passingScore"
                        label="Passing score"
                        helper="Required score in points. Leave blank to keep hidden."
                        min={0}
                        max={100}
                        allowEmpty
                      />
                      <SettingsNumberField
                        control={settingsForm.control}
                        name="attemptsAllowed"
                        label="Attempts allowed"
                        helper="Number of retries permitted per candidate."
                        min={1}
                        max={10}
                      />
                    </div>
                    <div className="space-y-4">
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="shuffleQuestions"
                        label="Shuffle questions"
                        description="Randomize question order for each candidate."
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="shuffleOptions"
                        label="Shuffle options"
                        description="Randomize answer option order within each question."
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="allowReviewAnswers"
                        label="Allow review before submit"
                        description="Let candidates revisit answers before final submission."
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="showResultsToCandidate"
                        label="Show results immediately"
                        description="Reveal scores to candidates after completion."
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="autoSubmitOnTimeUp"
                        label="Auto submit on time up"
                        description="Automatically submit responses when time expires."
                      />
                    </div>
                  </div>
                  <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground">Proctoring</h3>
                      <p className="text-xs text-muted-foreground">Decide which monitoring signals you need for this assessment.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="proctoring.enabled"
                        label="Enable proctoring"
                        description="Collect monitoring signals for exam integrity."
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="proctoring.recordScreen"
                        label="Record screen"
                        description="Capture candidate screen during the assessment."
                        disabled={!proctoringEnabled}
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="proctoring.recordWebcam"
                        label="Record webcam"
                        description="Capture webcam footage during the assessment."
                        disabled={!proctoringEnabled}
                      />
                      <ToggleSettingField
                        control={settingsForm.control}
                        name="proctoring.detectTabSwitch"
                        label="Detect tab switch"
                        description="Flag when a candidate switches away from the assessment tab."
                        disabled={!proctoringEnabled}
                      />
                    </div>
                  </div>
                  {isSettingsDirty ? (
                    <InlineToast
                      variant="default"
                      title="Unsaved changes"
                      description="Save updates or discard to keep the current configuration."
                    />
                  ) : null}
                </CardContent>
              </Card>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!isSettingsDirty || isSettingsSubmitting}>
                  {isSettingsSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isSettingsDirty || isSettingsSubmitting}
                  onClick={() => settingsForm.reset(settingsFormValues)}
                >
                  Discard
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="candidates" className="space-y-4">
          <AssessmentCandidatesTab
            invitations={invitations}
            isLoading={isInvitationsLoadingState}
            search={invitationSearch}
            status={invitationStatus}
            statusOptions={invitationStatusOptions}
            invitationStatusVariants={invitationStatusVariants}
            pagination={invitationPagination}
            onSearchChange={handleInvitationSearchChange}
            onStatusChange={handleInvitationStatusChange}
            onClearFilters={handleInvitationClearFilters}
            onPageChange={setInvitationPage}
            onResendInvitation={(invitationId) => resendInvitationMutation.mutate(invitationId)}
            resendPendingId={resendInvitationId}
            isResendPending={resendInvitationMutation.isPending}
            onCancelInvitation={handleCancelInvitation}
            cancelPendingId={cancelInvitationId}
            isCancelPending={cancelInvitationMutation.isPending}
            formatDateTime={formatDateTime}
            formatStatusLabel={formatStatusLabel}
            onInviteCandidate={() => setIsInviteDialogOpen(true)}
            inviteDisabled={createInvitationMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Results & analytics</CardTitle>
                  <CardDescription>Review performance, risk signals, and export-ready data.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Search candidates…"
                    value={resultsSearch}
                    onChange={(event) => {
                      setResultsSearch(event.target.value)
                      setResultsPage(1)
                    }}
                    className="w-full sm:w-56"
                  />
                  <Select
                    value={resultsStatus}
                    onValueChange={(value) => {
                      setResultsStatus(value as ResultStatusFilter)
                      setResultsPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {resultStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResultsStatus("all")
                      setResultsSearch("")
                      setResultsPage(1)
                    }}
                    disabled={!resultsSearch && resultsStatus === "all"}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isResultsLoadingState ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading results…
                </div>
              ) : results.length === 0 ? (
                <InlineToast
                  variant="default"
                  title="No results yet"
                  description="Candidate submissions will appear here once assessments are completed."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Proctoring</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => {
                        const percent = formatScorePercentage(result.score, result.total)
                        return (
                          <TableRow key={result.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{result.candidate}</span>
                                <span className="text-xs text-muted-foreground">{result.assessmentTitle}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-foreground">{percent}%</span>
                              <span className="block text-xs text-muted-foreground">
                                {result.score}/{result.total} pts
                              </span>
                            </TableCell>
                            <TableCell>{result.grade}</TableCell>
                            <TableCell>
                              <Badge variant={resultStatusVariants[result.status ?? "completed"] ?? "outline"} className="capitalize">
                                {formatStatusLabel(result.status ?? "completed")}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDateTime(result.submittedAt)}</TableCell>
                            <TableCell>
                              {result.proctoringFlag ? (
                              <Badge variant={result.proctoringFlag ? proctoringVariants[result.proctoringFlag] : "outline"} className="capitalize">
                                  {result.proctoringFlag}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {resultsPagination ? (
                <TablePagination
                  page={resultsPagination.page}
                  pageSize={resultsPagination.limit}
                  totalItems={resultsPagination.total}
                  onPageChange={setResultsPage}
                  disabled={isResultsLoadingState}
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <AnalyticsMetric title="Average score" value={`${scoreStats.average}%`} helper="Across completed submissions" />
            <AnalyticsMetric title="Highest score" value={`${scoreStats.highest}%`} helper="Best candidate performance" />
            <AnalyticsMetric title="Lowest score" value={`${scoreStats.lowest}%`} helper="Lowest observed score" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Score trend</CardTitle>
                <CardDescription>Average score across submissions over time.</CardDescription>
              </CardHeader>
              <CardContent>
                {scoreTrend.length === 0 ? (
                  <InlineToast
                    variant="default"
                    title="No score data yet"
                    description="Once candidates finish, their scores will appear here."
                  />
                ) : (
                  <ChartContainer
                    config={{ score: { label: "Average score", color: CHART_COLORS[0] } }}
                    className="h-[240px]"
                  >
                    <LineChart data={scoreTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="label" tickMargin={8} />
                      <YAxis domain={[0, 100]} width={30} />
                      <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                      <Line type="monotone" dataKey="value" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completions over time</CardTitle>
                <CardDescription>Daily completions for this assessment.</CardDescription>
              </CardHeader>
              <CardContent>
                {completionTrendData.length === 0 ? (
                  <InlineToast
                    variant="default"
                    title="No completions"
                    description="Completions will appear once candidates finish the assessment."
                  />
                ) : (
                  <ChartContainer
                    config={{ completions: { label: "Completions", color: CHART_COLORS[1] } }}
                    className="h-[240px]"
                  >
                    <LineChart data={completionTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="label" tickMargin={8} />
                      <YAxis allowDecimals={false} width={30} />
                      <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                      <Line type="monotone" dataKey="value" stroke="var(--color-completions)" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Invitation status</CardTitle>
                <CardDescription>Where candidates sit in the journey.</CardDescription>
              </CardHeader>
              <CardContent>
                {invitationStatusSlices.length === 0 ? (
                  <InlineToast
                    variant="default"
                    title="No invitation data"
                    description="Send invitations to see distribution."
                  />
                ) : (
                  <ChartContainer
                    config={invitationStatusSlices.reduce((acc, slice, index) => {
                      acc[slice.key] = { label: slice.label, color: CHART_COLORS[index % CHART_COLORS.length] }
                      return acc
                    }, {} as Record<string, { label: string; color: string }>)}
                    className="h-[240px]"
                  >
                    <BarChart data={invitationStatusSlices}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="label" tickMargin={8} />
                      <YAxis allowDecimals={false} width={30} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value">
                        {invitationStatusSlices.map((slice, index) => (
                          <Cell key={slice.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proctoring risk</CardTitle>
                <CardDescription>Signals observed across submissions.</CardDescription>
              </CardHeader>
              <CardContent>
                {proctoringSlices.length === 0 ? (
                  <InlineToast
                    variant="default"
                    title="No proctoring data"
                    description="Risk levels will show once proctoring data is captured."
                  />
                ) : (
                  <ChartContainer
                    config={proctoringSlices.reduce((acc, slice, index) => {
                      acc[slice.key] = { label: slice.label, color: CHART_COLORS[index % CHART_COLORS.length] }
                      return acc
                    }, {} as Record<string, { label: string; color: string }>)}
                    className="h-[240px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie data={proctoringSlices} dataKey="value" nameKey="label" innerRadius={60}>
                        {proctoringSlices.map((slice, index) => (
                          <Cell key={slice.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      <CandidateInviteDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSubmit={handleCreateInvitation}
        isSubmitting={createInvitationMutation.isPending}
        assessmentTitle={data.title}
      />
    </div>
  )
}

function AnalyticsMetric({ title, value, helper }: { title: string; value: string | number; helper?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  )
}

function SettingsNumberField<TFieldName extends Path<SettingsFormValues>>({
  control,
  name,
  label,
  helper,
  min,
  max,
  allowEmpty = false,
}: {
  control: Control<SettingsFormValues>
  name: TFieldName
  label: string
  helper?: string
  min?: number
  max?: number
  allowEmpty?: boolean
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel>{label}</FormLabel>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
          <FormControl>
            <Input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={field.value ?? ""}
              onChange={(event) => {
                const value = event.target.value
                if (allowEmpty && value === "") {
                  field.onChange("")
                  return
                }
                field.onChange(value === "" ? value : Number(value))
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function ToggleSettingField<TFieldName extends Path<SettingsFormValues>>({
  control,
  name,
  label,
  description,
  disabled,
}: {
  control: Control<SettingsFormValues>
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
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
