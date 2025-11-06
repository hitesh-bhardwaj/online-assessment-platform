"use client"

import { useQuery } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import { recruiterKeys } from "@/lib/query-keys"
import type { RecruiterProctoringDetails } from "@/app/api/recruiter/helpers"

interface Options {
  enabled?: boolean
}

interface RecruiterProctoringResponse {
  success: boolean
  data: RecruiterProctoringDetails
}

export function useRecruiterProctoring(resultId: string | null, { enabled = true }: Options = {}) {
  return useQuery<RecruiterProctoringDetails>({
    queryKey: recruiterKeys.proctoring(resultId),
    enabled: Boolean(resultId) && enabled,
    queryFn: async () => {
      if (!resultId) {
        throw new Error("Result identifier is required")
      }

      const response = await apiRequest<RecruiterProctoringResponse>({
        method: "GET",
        url: `/recruiter/results/${resultId}/proctoring`,
      })

      if (!response.success) {
        throw new Error("Unable to load proctoring details")
      }

      return response.data
    },
    staleTime: 10_000,
  })
}
