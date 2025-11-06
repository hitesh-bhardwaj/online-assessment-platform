"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"

export interface QuestionRecord {
  id: string
  title: string
  description?: string
  type: "mcq" | "msq" | "coding"
  difficulty: "easy" | "medium" | "hard"
  category?: string
  tags?: string[]
  points: number
  estimatedTimeMinutes: number
  status?: "draft" | "active" | "archived" | "under_review"
  options?: Array<{
    id: string
    text: string
    isCorrect: boolean
  }>
  codingDetails?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RecruiterQuestionFilters {
  search?: string
  type?: "mcq" | "msq" | "coding"
  difficulty?: "easy" | "medium" | "hard"
  category?: string
  status?: "draft" | "active" | "archived" | "under_review"
  tags?: string
}

export interface PaginatedQuestionsResponse {
  items: QuestionRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function useRecruiterQuestions(filters?: RecruiterQuestionFilters & { page?: number; limit?: number }) {
  const params = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string>

  return useQuery<PaginatedQuestionsResponse>({
    queryKey: ["recruiter", "questions", params],
    queryFn: () =>
      apiRequest<PaginatedQuestionsResponse>({
        url: "/recruiter/questions",
        method: "GET",
        params: Object.keys(params).length ? params : undefined,
      }),
  })
}

export interface CreateQuestionInput {
  title: string
  description?: string
  type: "mcq" | "msq" | "coding"
  difficulty: "easy" | "medium" | "hard"
  category?: string
  tags?: string[]
  points?: number
  estimatedTimeMinutes?: number
  options?: Array<{ id: string; text: string; isCorrect: boolean }>
  codingDetails?: Record<string, unknown>
  explanation?: string
}

export function useCreateRecruiterQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateQuestionInput) =>
      apiRequest<QuestionRecord>({ url: "/recruiter/questions", method: "POST", data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "questions"] })
    },
  })
}

// Duplicate question
export function useDuplicateQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (questionId: string) =>
      apiRequest<QuestionRecord>({ url: `/recruiter/questions/${questionId}/duplicate`, method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "questions"] })
    },
  })
}

// Question statistics
export interface QuestionStats {
  question: {
    id: string
    title: string
    type: string
    difficulty: string
    status: string
  }
  usage: {
    assessmentCount: number
    publishedAssessmentCount: number
    canDelete: boolean
    canEdit: boolean
  }
  performance: {
    totalAttempts: number
    correctAnswers: number
    successRate: string
    averageScore: string
    averageTimeSpent: string
  }
}

export function useQuestionStats(questionId: string | null) {
  return useQuery<{ success: boolean; data: QuestionStats }>({
    queryKey: ["recruiter", "questions", questionId, "stats"],
    queryFn: () =>
      apiRequest<{ success: boolean; data: QuestionStats }>({
        url: `/recruiter/questions/${questionId}/stats`,
        method: "GET",
      }),
    enabled: !!questionId,
  })
}

// Question preview
export interface QuestionPreview {
  id: string
  title: string
  description: string
  type: string
  difficulty: string
  category: string
  tags: string[]
  points: number
  estimatedTimeMinutes: number
  options?: Array<{ id: string; text: string }>
  codingDetails?: {
    language: string
    starterCode?: string
    timeLimit: number
    memoryLimit: number
    visibleTestCases: Array<{ input: string; expectedOutput: string }>
  }
}

export function useQuestionPreview(questionId: string | null) {
  return useQuery<{ success: boolean; data: QuestionPreview }>({
    queryKey: ["recruiter", "questions", questionId, "preview"],
    queryFn: () =>
      apiRequest<{ success: boolean; data: QuestionPreview }>({
        url: `/recruiter/questions/${questionId}/preview`,
        method: "GET",
      }),
    enabled: !!questionId,
  })
}

// Batch operations
export function useBatchUpdateQuestions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { questionIds: string[]; updates: Partial<QuestionRecord> }) =>
      apiRequest<{ success: boolean; message: string; data: { matchedCount: number; modifiedCount: number } }>({
        url: "/recruiter/questions/batch",
        method: "PATCH",
        data: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "questions"] })
    },
  })
}

export function useBatchDeleteQuestions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (questionIds: string[]) =>
      apiRequest<{ success: boolean; message: string }>({
        url: "/recruiter/questions/batch",
        method: "DELETE",
        data: { questionIds },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "questions"] })
    },
  })
}

// Metadata with counts
export interface QuestionMetadata {
  categories: Array<{ name: string; count: number }>
  tags: Array<{ name: string; count: number }>
  statistics: {
    byType: Record<string, number>
    byDifficulty: Record<string, number>
    byStatus: Record<string, number>
  }
}

export function useQuestionMetadata() {
  return useQuery<{ success: boolean; data: QuestionMetadata }>({
    queryKey: ["recruiter", "questions", "metadata"],
    queryFn: () =>
      apiRequest<{ success: boolean; data: QuestionMetadata }>({
        url: "/recruiter/questions/metadata",
        method: "GET",
      }),
  })
}

// Export questions
export function useExportQuestions() {
  return useMutation({
    mutationFn: async (payload: { format: "json" | "csv"; questionIds?: string[] }) => {
      const params = new URLSearchParams()
      params.append("format", payload.format)
      if (payload.questionIds) {
        payload.questionIds.forEach((id) => params.append("questionIds", id))
      }

      const response = await fetch(`/api/recruiter/questions/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `questions-${Date.now()}.${payload.format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return { success: true }
    },
  })
}

// Random questions
export function useRandomQuestions(filters?: {
  count?: number
  type?: string
  difficulty?: string
  category?: string
  tags?: string
}) {
  return useQuery<{ success: boolean; data: { questions: QuestionRecord[]; count: number; requestedCount: number } }>({
    queryKey: ["recruiter", "questions", "random", filters],
    queryFn: () =>
      apiRequest<{ success: boolean; data: { questions: QuestionRecord[]; count: number; requestedCount: number } }>({
        url: "/recruiter/questions/random",
        method: "GET",
        params: filters as Record<string, string>,
      }),
    enabled: false, // Manual trigger only
  })
}
