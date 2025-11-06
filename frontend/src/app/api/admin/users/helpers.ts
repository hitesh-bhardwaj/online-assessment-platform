import type { AdminUserRecord } from "@/lib/admin-data"

export interface BackendUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  role: "admin" | "recruiter"
  isActive: boolean
  invitedAt?: string | null
  lastLogin?: string | null
}

export function toAdminUserRecord(user: BackendUser): AdminUserRecord {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

  let status: AdminUserRecord["status"] = "active"
  if (!user.isActive) {
    status = "suspended"
  } else if (user.invitedAt && !user.lastLogin) {
    status = "invited"
  }

  return {
    id: user._id,
    name: fullName,
    email: user.email,
    role: user.role,
    status,
    lastLogin: user.lastLogin ?? undefined,
  }
}
