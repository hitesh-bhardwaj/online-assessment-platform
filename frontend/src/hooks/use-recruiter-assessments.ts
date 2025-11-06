"use client"

import { useQuery } from "@tanstack/react-query"

import type { AssessmentSummary } from "@/lib/recruiter-data"
import type { PaginatedResponse } from "@/app/api/recruiter/helpers"
import { apiRequest } from "@/lib/api-client"
import { recruiterKeys } from "@/lib/query-keys"

export interface RecruiterAssessmentsQuery {
  page?: number
  limit?: number
  type?: "mcq" | "coding" | "mixed"
  status?: "draft" | "published" | "archived"
  search?: string
}

export function useRecruiterAssessments(params?: RecruiterAssessmentsQuery) {
  const filters = params ?? {}
  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string | number>
  const hasFilters = Object.keys(query).length > 0

  return useQuery<PaginatedResponse<AssessmentSummary>>({
    queryKey: recruiterKeys.assessments(query),
    queryFn: () =>
      apiRequest<PaginatedResponse<AssessmentSummary>>({
        url: "/recruiter/assessments",
        method: "GET",
        params: hasFilters ? query : undefined,
      }),
  })
}
