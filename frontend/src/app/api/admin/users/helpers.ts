import type { AdminUserRecord } from '@/lib/admin-data';

export interface BackendUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'recruiter';
  isActive: boolean;
  invitedAt?: string | null;
  lastLogin?: string | Date | null;
  status?: 'active' | 'suspended';
}

// export function toAdminUserRecord(user: BackendUser): AdminUserRecord {
//   const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

//   let status: AdminUserRecord["status"] = "active"
//   if (!user.isActive) {
//     status = "suspended"
//   } else if (user.invitedAt && !user.lastLogin) {
//     status = "invited"
//   }

//   return {
//     id: user._id,
//     name: fullName,
//     email: user.email,
//     role: user.role,
//     status,
//     lastLogin: user.lastLogin ?? undefined,
//   }
// }

export function toAdminUserRecord(b: BackendUser): AdminUserRecord {
  return {
    id: b._id,
    name: `${b.firstName} ${b.lastName}`.trim(),
    email: b.email,
    role: b.role,
    status: b.status ?? (b.isActive ? 'active' : 'suspended'), // fallback
    lastLogin: b.lastLogin ? new Date(b.lastLogin).toLocaleString() : null,
  };
}
