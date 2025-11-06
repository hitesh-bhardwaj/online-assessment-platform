"use client"

import { useQuery } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import { candidateKeys } from "@/lib/query-keys"

export interface CandidateInvitationDetail {
  id: string
  assessmentId?: string
  assessmentTitle?: string
  status: string
  validFrom?: string
  validUntil?: string
  candidate: {
    firstName?: string
    lastName?: string
    email: string
  }
  metadata?: Record<string, unknown>
}

export function useCandidateInvitation(token: string | null) {
  return useQuery<CandidateInvitationDetail>({
    queryKey: candidateKeys.invitation(token ?? ""),
    enabled: Boolean(token),
    retry: false,
    queryFn: () =>
      apiRequest<CandidateInvitationDetail>({
        url: `/candidate/invitations/${token}`,
        method: "GET",
      }),
  })
}
