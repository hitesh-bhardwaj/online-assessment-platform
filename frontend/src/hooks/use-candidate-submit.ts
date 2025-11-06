"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import { candidateKeys } from "@/lib/query-keys"
import { useToast } from "@/hooks/use-toast"
import type { CandidateAssessmentBundle } from "@/hooks/use-candidate-assessment"

interface SubmitCandidateAssessmentResponse {
  success: boolean
  data?: {
    summary: {
      score: CandidateAssessmentBundle["resultSummary"] extends infer S
        ? S extends { score: infer Score }
          ? Score
          : {
              total: number
              earned: number
              percentage: number
              breakdown: Record<string, { total: number; earned: number; count: number }>
            }
        : never
      submittedAt?: string
    }
  }
}

export function useCandidateSubmit(assessmentId: string, token: string | undefined) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationKey: ["candidate", "submit", assessmentId],
    mutationFn: async () => {
      if (!token) {
        throw new Error("Missing candidate token")
      }

      return apiRequest<SubmitCandidateAssessmentResponse>({
        method: "POST",
        url: `/candidate/assessments/${assessmentId}/submit`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    onSuccess: (response) => {
      if (!response.success) return

      queryClient.setQueryData<CandidateAssessmentBundle | undefined>(candidateKeys.assessment(assessmentId), (previous) => {
        if (!previous) return previous
        return {
          ...previous,
          progress: {
            ...(previous.progress ?? { status: "completed", responses: [] }),
            status: "completed",
          },
          resultSummary: response.data?.summary ?? previous.resultSummary,
        }
      })
    },
    onError: (error) => {
      console.error('[Submit] ❌ Failed to submit assessment:', error)

      // Show error toast to user
      toast({
        title: "Submission failed",
        description: "We couldn't submit your assessment. Please check your internet connection and try again.",
        variant: "destructive",
      })

      // Invalidate query to allow retry with fresh data
      queryClient.invalidateQueries({ queryKey: candidateKeys.assessment(assessmentId) })
    },
  })
}
