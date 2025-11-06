"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"

// Enhanced Assessment Record with all new fields
export interface AssessmentRecord {
  id: string
  title: string
  description?: string
  type: "mcq" | "coding" | "mixed"
  status: "draft" | "active" | "archived" | "scheduled" | "under_review"
  isPublished: boolean
  publishedAt?: string

  // Metadata
  tags?: string[]
  category?: string
  department?: string
  jobRole?: string

  // Scheduling
  scheduledStartDate?: string
  scheduledEndDate?: string

  // Settings
  settings: {
    timeLimit: number
    shuffleQuestions: boolean
    shuffleOptions: boolean
    allowReviewAnswers: boolean
    showResultsToCandidate: boolean
    autoSubmitOnTimeUp: boolean
    passingScore?: number
    attemptsAllowed: number
    proctoringSettings: {
      enabled: boolean
      recordScreen: boolean
      recordWebcam: boolean
      detectTabSwitch: boolean
      detectCopyPaste: boolean
      detectMultipleMonitors: boolean
    }
  }

  questions: Array<{
    questionId: string
    order: number
    points: number
  }>

  instructions?: string
  createdBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

export interface AssessmentFilters {
  page?: number
  limit?: number
  type?: "mcq" | "coding" | "mixed"
  status?: "draft" | "active" | "archived" | "scheduled" | "under_review"
  isPublished?: boolean
  search?: string
  createdBy?: string
}

export interface PaginatedAssessmentsResponse {
  assessments: AssessmentRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Get assessments with enhanced filters
export function useRecruiterAssessmentsEnhanced(filters?: AssessmentFilters) {
  const params = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string>

  return useQuery<{ success: boolean; data: PaginatedAssessmentsResponse }>({
    queryKey: ["recruiter", "assessments", params],
    queryFn: () =>
      apiRequest<{ success: boolean; data: PaginatedAssessmentsResponse }>({
        url: "/recruiter/assessments",
        method: "GET",
        params: Object.keys(params).length ? params : undefined,
      }),
  })
}

// Create assessment
export interface CreateAssessmentInput {
  title: string
  description?: string
  type: "mcq" | "coding" | "mixed"
  questions: Array<{
    questionId: string
    order: number
    points: number
  }>
  settings: AssessmentRecord["settings"]
  instructions?: string
  status?: "draft" | "active" | "archived" | "scheduled" | "under_review"
  tags?: string[]
  category?: string
  department?: string
  jobRole?: string
  scheduledStartDate?: string
  scheduledEndDate?: string
}

export function useCreateAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateAssessmentInput) =>
      apiRequest<{ success: boolean; data: AssessmentRecord }>({
        url: "/recruiter/assessments",
        method: "POST",
        data: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"] })
    },
  })
}

// Update assessment
export function useUpdateAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assessmentId, data }: { assessmentId: string; data: Partial<CreateAssessmentInput> }) =>
      apiRequest<{ success: boolean; data: AssessmentRecord }>({
        url: `/recruiter/assessments/${assessmentId}`,
        method: "PUT",
        data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"] })
    },
  })
}

// Duplicate assessment
export function useDuplicateAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assessmentId: string) =>
      apiRequest<{ success: boolean; data: AssessmentRecord }>({
        url: `/recruiter/assessments/${assessmentId}/duplicate`,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"] })
    },
  })
}

// Preview assessment
export interface AssessmentPreview {
  id: string
  title: string
  description?: string
  type: string
  instructions?: string
  status: string
  tags?: string[]
  category?: string
  department?: string
  jobRole?: string
  settings: Partial<AssessmentRecord["settings"]>
  questions: Array<{
    order: number
    points: number
    question: any
  }>
  totalPoints: number
  estimatedDuration: number
}

export function useAssessmentPreview(assessmentId: string | null) {
  return useQuery<{ success: boolean; data: AssessmentPreview }>({
    queryKey: ["recruiter", "assessments", assessmentId, "preview"],
    queryFn: () =>
      apiRequest<{ success: boolean; data: AssessmentPreview }>({
        url: `/recruiter/assessments/${assessmentId}/preview`,
        method: "GET",
      }),
    enabled: !!assessmentId,
  })
}

// Validate assessment
export interface AssessmentValidation {
  canPublish: boolean
  errors: string[]
  warnings: string[]
  info: {
    questionCount: number
    totalPoints: number
    estimatedDuration: number
    hasScheduling: boolean
  }
}

export function useAssessmentValidation(assessmentId: string | null) {
  return useQuery<{ success: boolean; data: AssessmentValidation }>({
    queryKey: ["recruiter", "assessments", assessmentId, "validate"],
    queryFn: () =>
      apiRequest<{ success: boolean; data: AssessmentValidation }>({
        url: `/recruiter/assessments/${assessmentId}/validate`,
        method: "GET",
      }),
    enabled: !!assessmentId,
  })
}

// Publish assessment
export function usePublishAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assessmentId: string) =>
      apiRequest<{ success: boolean; message: string }>({
        url: `/recruiter/assessments/${assessmentId}/publish`,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"] })
    },
  })
}

// Unpublish assessment
export function useUnpublishAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assessmentId: string) =>
      apiRequest<{ success: boolean; message: string }>({
        url: `/recruiter/assessments/${assessmentId}/unpublish`,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"] })
    },
  })
}

// Delete assessment
export function useDeleteAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (assessmentId: string) =>
      apiRequest<{ success: boolean; message: string }>({
        url: `/recruiter/assessments/${assessmentId}`,
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter", "assessments"] })
    },
  })
}

// Get assessment statistics
export interface AssessmentStats {
  assessment: {
    id: string
    title: string
    type: string
    questionCount: number
    totalPoints: number
    estimatedDuration: number
    isPublished: boolean
    createdAt: string
  }
  invitations: {
    total: number
    pending: number
    started: number
    completed: number
    expired: number
  }
  results: {
    avgScore: number
    maxScore: number
    minScore: number
    totalSubmissions: number
    avgDuration: number
  }
}

export function useAssessmentStats(assessmentId: string | null) {
  return useQuery<{ success: boolean; data: AssessmentStats }>({
    queryKey: ["recruiter", "assessments", assessmentId, "stats"],
    queryFn: () =>
      apiRequest<{ success: boolean; data: AssessmentStats }>({
        url: `/recruiter/assessments/${assessmentId}/stats`,
        method: "GET",
      }),
    enabled: !!assessmentId,
  })
}
