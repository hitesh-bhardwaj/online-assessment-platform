"use client"

import { useQuery } from "@tanstack/react-query"

import type { ResultSummary } from "@/lib/recruiter-data"
import type { PaginatedResponse } from "@/app/api/recruiter/helpers"
import { apiRequest } from "@/lib/api-client"
import { recruiterKeys } from "@/lib/query-keys"

export interface RecruiterResultsQuery {
  page?: number
  limit?: number
  status?: "in_progress" | "completed" | "auto_submitted" | "disqualified"
  assessmentId?: string
  search?: string
  minScore?: number
  maxScore?: number
}

export function useRecruiterResults(params?: RecruiterResultsQuery) {
  const filters = params ?? {}
  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string | number>
  const hasFilters = Object.keys(query).length > 0

  return useQuery<PaginatedResponse<ResultSummary>>({
    queryKey: recruiterKeys.results(query),
    queryFn: () =>
      apiRequest<PaginatedResponse<ResultSummary>>({
        url: "/recruiter/results",
        method: "GET",
        params: hasFilters ? query : undefined,
      }),
  })
}
