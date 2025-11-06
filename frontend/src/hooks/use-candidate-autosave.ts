"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import { candidateKeys } from "@/lib/query-keys"
import type { CandidateAssessmentBundle } from "@/hooks/use-candidate-assessment"

interface AutosaveInput {
  token: string
  assessmentId: string
  questionId: string
  answer: unknown
  timeTaken?: number
}

interface AutosaveResponse {
  success: boolean
  data?: {
    questionId: string
    status: string
  }
}

export function useCandidateAutosave(assessmentId: string, token: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["candidate", "autosave", assessmentId],
    mutationFn: async ({ questionId, answer, timeTaken }: Omit<AutosaveInput, "token" | "assessmentId">) => {
      if (!token) {
        throw new Error("Missing candidate token")
      }

      return apiRequest<AutosaveResponse>({
        method: "POST",
        url: `/candidate/assessments/${assessmentId}/progress`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          questionId,
          answer,
          timeTaken,
        },
      })
    },
    onSuccess: (response, variables) => {
      if (!response.success) return

      queryClient.setQueryData<CandidateAssessmentBundle | undefined>(candidateKeys.assessment(assessmentId), (previous) => {
        if (!previous) return previous

        const existingResponses = previous.progress?.responses ?? []
        const existingIndex = existingResponses.findIndex((response) => response.questionId === variables.questionId)

        const nextResponses = [...existingResponses]
        if (existingIndex >= 0) {
          nextResponses[existingIndex] = {
            ...nextResponses[existingIndex],
            answer: variables.answer,
            timeTaken: variables.timeTaken ?? 0,
          }
        } else {
          nextResponses.push({
            questionId: variables.questionId,
            answer: variables.answer,
            timeTaken: variables.timeTaken ?? 0,
            attempts: 1,
          })
        }

        return {
          ...previous,
          progress: {
            status: response.data?.status ?? previous.progress?.status ?? "in_progress",
            responses: nextResponses,
          },
        }
      })
    },
  })
}
