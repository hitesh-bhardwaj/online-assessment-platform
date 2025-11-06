import type { OrganizationPlan } from "@/lib/auth-context"

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

export interface AdminUserRecord {
  id: string
  name: string
  email: string
  role: "admin" | "recruiter"
  status: "active" | "invited" | "suspended"
  lastLogin?: string
}

export interface AuditLogRecord {
  id: string
  timestamp: string
  category: "auth" | "security" | "system"
  action: string
  actor: string
  status: "success" | "warning" | "error"
  metadata: string
}
