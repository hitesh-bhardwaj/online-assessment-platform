"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"

export interface AssessmentDetail {
  _id: string
  title: string
  description?: string
  type: "mcq" | "coding" | "mixed"
  isActive?: boolean
  tags?: string[]
  category?: string
  department?: string
  jobRole?: string
  scheduledStartDate?: string
  scheduledEndDate?: string
  questions: Array<{
    questionId: string
    order: number
    points: number
    question?: {
      _id: string
      title: string
      type: string
      difficulty: string
    }
  }>
  settings: {
    timeLimit?: number
    passingScore?: number
    attemptsAllowed?: number
    shuffleQuestions?: boolean
    shuffleOptions?: boolean
    allowReviewAnswers?: boolean
    showResultsToCandidate?: boolean
    autoSubmitOnTimeUp?: boolean
    proctoringSettings?: {
      enabled?: boolean
      recordScreen?: boolean
      recordWebcam?: boolean
      detectTabSwitch?: boolean
      detectCopyPaste?: boolean
      detectMultipleMonitors?: boolean
      allowedApps?: string[]
      blockedWebsites?: string[]
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  instructions?: string
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAssessmentInput {
  title: string
  description?: string
  type: "mcq" | "coding" | "mixed"
  tags?: string[]
  category?: string
  department?: string
  jobRole?: string
  scheduledStartDate?: string
  scheduledEndDate?: string
  questions: Array<{ questionId: string; order: number; points: number }>
  instructions?: string
  settings: Record<string, unknown>
}

export interface UpdateAssessmentInput {
  id: string
  body: Partial<{
    title: string
    description?: string
    instructions?: string
    tags?: string[]
    category?: string
    department?: string
    jobRole?: string
    scheduledStartDate?: string
    scheduledEndDate?: string
    settings: AssessmentDetail["settings"]
    questions: AssessmentDetail["questions"]
  }>
}

const detailKey = (id: string) => ["recruiter", "assessment", id] as const

type RawQuestion = {
  questionId: string | { _id?: string; title?: string; type?: string; difficulty?: string }
  order: number
  points: number
  question?: {
    _id?: string
    title?: string
    type?: string
    difficulty?: string
  }
}

type RawAssessmentDetail = Omit<AssessmentDetail, "questions"> & {
  questions: RawQuestion[]
}

function normalizeAssessmentDetail(raw: RawAssessmentDetail): AssessmentDetail {
  const normalizedQuestions = (raw.questions ?? []).map((item) => {
    const questionIdValue =
      typeof item.questionId === "string" ? item.questionId : item.questionId?._id ?? ""
    const questionMeta = item.question ?? (typeof item.questionId === "object" ? item.questionId : undefined)

    return {
      questionId: questionIdValue,
      order: item.order,
      points: item.points,
      question: questionMeta
        ? {
            _id: questionMeta._id ?? questionIdValue,
            title: questionMeta.title ?? "Untitled question",
            type: (questionMeta.type as AssessmentDetail["questions"][number]["question"]["type"]) ?? "mcq",
            difficulty:
              (questionMeta.difficulty as AssessmentDetail["questions"][number]["question"]["difficulty"]) ??
              "medium",
          }
        : undefined,
    }
  })

  return {
    ...raw,
    questions: normalizedQuestions,
  }
}

export function useRecruiterAssessment(id?: string) {
  return useQuery<AssessmentDetail>({
    queryKey: detailKey(id ?? "new"),
    queryFn: () =>
      apiRequest<RawAssessmentDetail>({ url: `/recruiter/assessments/${id}`, method: "GET" }).then(
        normalizeAssessmentDetail
      ),
    enabled: Boolean(id),
  })
}

export function useCreateRecruiterAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateAssessmentInput) =>
      apiRequest<RawAssessmentDetail>({ url: "/recruiter/assessments", method: "POST", data: payload }).then(
        normalizeAssessmentDetail
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"], exact: false })
    },
  })
}

export function useUpdateRecruiterAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: UpdateAssessmentInput) =>
      apiRequest<RawAssessmentDetail>({ url: `/recruiter/assessments/${id}`, method: "PUT", data: body }).then(
        normalizeAssessmentDetail
      ),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData(detailKey(id), updated)
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"], exact: false })
    },
  })
}
