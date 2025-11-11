"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { OrganizationRecord } from "@/lib/admin-data"
import { apiRequest } from "@/lib/api-client"
import { adminKeys } from "@/lib/query-keys"

export interface OrganizationDetails {
  organization: {
    _id: string
    name: string
    domain?: string
    contactEmail?: string
    branding?: Record<string, unknown>
    settings?: {
      dataRetentionDays?: number
      gdprCompliant?: boolean
      allowCandidateDataDownload?: boolean
      requireProctoringConsent?: boolean
    }
    [key: string]: unknown
  } | null
  usage: {
    users?: number
    subscription?: {
      plan?: string
      features?: string[]
      limits?: {
        maxAssessments?: number
        maxCandidatesPerMonth?: number
      }
    }
  } | null
  summary: OrganizationRecord | null
}

export function useAdminOrganizations() {
  return useQuery<OrganizationDetails>({
    queryKey: adminKeys.organizations(),
    queryFn: () => apiRequest<OrganizationDetails>({ url: "/admin/organizations", method: "GET" }),
  })
}

export function useUpdateAdminOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<OrganizationDetails>({ url: "/admin/organizations", method: "PATCH", data: payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.organizations(), data)
    },
  })
}
