import type { OrganizationPlan } from "@/lib/auth-context"

/** Standard pagination meta used across admin endpoints */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

/** Standard paginated response shape (always includes `pagination`) */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: PaginationMeta
}

export interface OrganizationRecord {
  id: string
  name: string
  domain: string
  plan: OrganizationPlan
  seatsUsed: number
  seatLimit: number
  dataRetentionDays: number
  gdprCompliant: boolean
  primaryContact: string
}

export type AdminUserRole = "admin" | "recruiter"
export type AdminUserStatus = "active" | "invited" | "suspended"

export interface AdminUserRecord {
  id: string
  name: string
  email: string
  role: AdminUserRole
  status: AdminUserStatus
  /** ISO string or null when never logged in */
  lastLogin?: string | null
}

export type AuditCategory = "auth" | "security" | "system"
export type AuditStatus = "success" | "warning" | "error"

export interface AuditLogRecord {
  id: string
  timestamp: string // ISO
  category: AuditCategory
  action: string
  actor: string
  status: AuditStatus
  metadata: string
}
