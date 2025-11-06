"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { InvitationSummary, InvitationDetail } from "@/lib/recruiter-data"
import type { PaginatedResponse } from "@/app/api/recruiter/helpers"
import { apiRequest } from "@/lib/api-client"
import { recruiterKeys } from "@/lib/query-keys"

export interface RecruiterInvitationsQuery {
  page?: number
  limit?: number
  status?: "pending" | "started" | "submitted" | "expired" | "cancelled"
  search?: string
  assessmentId?: string
}

export function useRecruiterInvitations(params?: RecruiterInvitationsQuery) {
  const filters = params ?? {}
  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string | number>
  const hasFilters = Object.keys(query).length > 0

  return useQuery<PaginatedResponse<InvitationSummary>>({
    queryKey: recruiterKeys.invitations(query),
    queryFn: () =>
      apiRequest<PaginatedResponse<InvitationSummary>>({
        url: "/recruiter/invitations",
        method: "GET",
        params: hasFilters ? query : undefined,
      }),
  })
}

export interface CreateRecruiterInvitationInput {
  assessmentId: string
  candidate: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    resumeUrl?: string
    position?: string
  }
  validFrom?: string
  validUntil: string
  customMessage?: string
}

export function useCreateRecruiterInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateRecruiterInvitationInput) =>
      apiRequest<{ success: boolean; message: string; data: InvitationSummary }>({
        url: "/recruiter/invitations",
        method: "POST",
        data: payload,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: recruiterKeys.invitations(), exact: false })
      toast.success("Invitation sent successfully", {
        description: `Invitation sent to ${data.data.candidate.email}`,
      })
    },
    onError: (error: any) => {
      toast.error("Failed to send invitation", {
        description: error?.message || "Please try again later",
      })
    },
  })
}

export function useCancelRecruiterInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest<{ success: boolean; message: string }>({
        url: `/recruiter/invitations/${invitationId}/cancel`,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recruiterKeys.invitations(), exact: false })
    },
  })
}

export function useResendRecruiterInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest<{ success: boolean; message: string; data: InvitationSummary }>({
        url: `/recruiter/invitations/${invitationId}/resend`,
        method: "POST",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: recruiterKeys.invitations(), exact: false })
      toast.success("Invitation resent successfully", {
        description: `Invitation resent to ${data.data.candidate.email}`,
      })
    },
    onError: (error: any) => {
      toast.error("Failed to resend invitation", {
        description: error?.message || "Please try again later",
      })
    },
  })
}

export function useRecruiterInvitation(invitationId: string) {
  return useQuery<InvitationDetail>({
    queryKey: recruiterKeys.invitation(invitationId),
    queryFn: () =>
      apiRequest<InvitationDetail>({
        url: `/recruiter/invitations/${invitationId}`,
        method: "GET",
      }),
    enabled: !!invitationId,
  })
}
