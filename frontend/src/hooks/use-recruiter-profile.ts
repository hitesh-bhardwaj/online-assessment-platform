"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"

interface RecruiterProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  permissions: string[]
  organization?: {
    id?: string
    _id?: string
    name?: string
    domain?: string
  }
}

interface UpdateProfileInput {
  firstName: string
  lastName: string
}

const queryKey = ["recruiter", "profile"] as const

export function useRecruiterProfile() {
  return useQuery<RecruiterProfile>({
    queryKey,
    queryFn: () => apiRequest<RecruiterProfile>({ url: "/recruiter/profile", method: "GET" }),
  })
}

export function useUpdateRecruiterProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateProfileInput) =>
      apiRequest<RecruiterProfile>({ url: "/recruiter/profile", method: "PATCH", data: payload }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
    },
  })
}
