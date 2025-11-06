"use client"

import { useQuery } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import type { CandidateSession } from "@/lib/candidate-session"
import { candidateKeys } from "@/lib/query-keys"

export type CandidateAssessmentQuestion =
  | {
      id: string
      order: number
      points: number
      type: "mcq" | "msq"
      title: string
      description?: string
      difficulty?: string
      estimatedTimeMinutes?: number
      category?: string
      tags?: string[]
      options: Array<{ id: string; text: string }>
    }
  | {
      id: string
      order: number
      points: number
      type: "coding"
      title: string
      description?: string
      difficulty?: string
      estimatedTimeMinutes?: number
      category?: string
      tags?: string[]
      codingDetails: {
        language: string
        starterCode?: string
        timeLimit?: number
        memoryLimit?: number
        sampleTestCases: Array<{ input: string; expectedOutput: string }>
      }
    }
  | {
      id: string
      order: number
      points: number
      type: "mcq" | "msq" | "coding" | string
      title: string
      description?: string
      difficulty?: string
      estimatedTimeMinutes?: number
      category?: string
      tags?: string[]
    }

export interface CandidateAssessmentProgress {
  status: string
  responses: Array<{
    questionId: string
    answer: unknown
    timeTaken: number
    attempts: number
  }>
}

export interface CandidateAssessmentBundle {
  assessment: {
    id: string
    title: string
    description?: string
    type?: string
    instructions?: string
    settings?: Record<string, unknown>
    questionCount: number
  }
  questions: CandidateAssessmentQuestion[]
  session: {
    status: string
    validFrom?: string
    validUntil?: string
    attemptsUsed: number
    remindersSent: number
    startedAt?: string
    serverTime?: string
  }
  progress: CandidateAssessmentProgress | null
  resultSummary?: {
    score: {
      total: number
      earned: number
      percentage: number
      breakdown: Record<string, { total: number; earned: number; count: number }>
    }
    submittedAt?: string
  }
}

export function useCandidateAssessment(assessmentId: string | undefined, candidateSession: CandidateSession | null) {
  return useQuery<CandidateAssessmentBundle>({
    queryKey: candidateKeys.assessment(assessmentId ?? "unknown"),
    enabled: Boolean(assessmentId && candidateSession?.token && candidateSession.session.assessmentId === assessmentId),
    queryFn: async () => {
      if (!assessmentId || !candidateSession?.token) {
        throw new Error("Missing assessment context")
      }

      const response = await apiRequest<{ success: boolean; data: CandidateAssessmentBundle }>({
        method: "GET",
        url: `/candidate/assessments/${assessmentId}`,
        headers: {
          Authorization: `Bearer ${candidateSession.token}`,
        },
      })

      if (!response.success || !response.data) {
        throw new Error("Unable to load assessment")
      }

      return response.data
    },
    retry: 1,
    staleTime: 30_000,
    select: (bundle) => {
      if (!bundle.session.startedAt || !bundle.session.serverTime) return bundle
      const serverTime = new Date(bundle.session.serverTime).getTime()
      const drift = Date.now() - serverTime
      const adjusted = new Date(new Date(bundle.session.startedAt).getTime() + drift).toISOString()
      return {
        ...bundle,
        session: {
          ...bundle.session,
          startedAt: adjusted,
        },
      }
    },
  })
}
