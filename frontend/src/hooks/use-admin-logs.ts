"use client"

import { useQuery } from "@tanstack/react-query"

import type { AuditLogRecord } from "@/lib/admin-data"
import type { PaginatedResponse } from "@/app/api/recruiter/helpers"
import { apiRequest } from "@/lib/api-client"
import { adminKeys } from "@/lib/query-keys"

export interface AdminLogFilters {
  page?: number
  limit?: number
  status?: "success" | "warning" | "error"
  category?: "auth" | "security" | "system"
  search?: string
}

export function useAdminLogs(filters?: AdminLogFilters) {
  const params = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, string | number>

  return useQuery<PaginatedResponse<AuditLogRecord>>({
    queryKey: adminKeys.logs(params),
    queryFn: () =>
      apiRequest<PaginatedResponse<AuditLogRecord>>({
        url: "/admin/logs",
        method: "GET",
        params: Object.keys(params).length ? params : undefined,
      }),
  })
}
