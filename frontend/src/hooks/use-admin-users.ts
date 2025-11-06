"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { AdminUserRecord } from "@/lib/admin-data"
import type { PaginatedResponse } from "@/app/api/recruiter/helpers"
import { apiRequest } from "@/lib/api-client"
import { adminKeys } from "@/lib/query-keys"

export type InviteUserPayload = {
  email: string
  role: "admin" | "recruiter"
  firstName: string
  lastName: string
  password: string
}

export type UpdateUserStatusPayload = {
  userId: string
  status: "active" | "suspended"
}

export interface AdminUsersQuery {
  page?: number
  limit?: number
  role?: "admin" | "recruiter"
  status?: "active" | "invited" | "suspended"
  search?: string
}

export function useAdminUsers(filters?: AdminUsersQuery) {
  const params = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string | number>

  return useQuery<PaginatedResponse<AdminUserRecord>>({
    queryKey: adminKeys.usersList(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<AdminUserRecord>>({
        url: "/admin/users",
        method: "GET",
        params: Object.keys(params).length ? params : undefined,
      }),
  })
}

export function useInviteAdminUser() {
  const queryClient = useQueryClient()
  const defaultPermissions = (role: "admin" | "recruiter") => {
    if (role === "admin") {
      return {
        assessments: { create: true, read: true, update: true, delete: true },
        questions: { create: true, read: true, update: true, delete: true },
        invitations: { create: true, read: true, update: true, delete: true },
        results: { read: true, export: true, delete: true },
        users: { create: true, read: true, update: true, delete: true },
        organization: { read: true, update: true },
      }
    }

    return {
      assessments: { create: true, read: true, update: true, delete: false },
      questions: { create: true, read: true, update: true, delete: false },
      invitations: { create: true, read: true, update: true, delete: false },
      results: { read: true, export: true, delete: false },
      users: { create: false, read: false, update: false, delete: false },
      organization: { read: true, update: false },
    }
  }
  return useMutation({
    mutationFn: (payload: InviteUserPayload) =>
      apiRequest<AdminUserRecord>({
        url: "/admin/users",
        method: "POST",
        data: {
          ...payload,
          permissions: defaultPermissions(payload.role),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), exact: false })
    },
  })
}

export function useUpdateAdminUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status }: UpdateUserStatusPayload) =>
      apiRequest<AdminUserRecord>({ url: `/admin/users/${userId}`, method: "PATCH", data: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users(), exact: false })
    },
  })
}
