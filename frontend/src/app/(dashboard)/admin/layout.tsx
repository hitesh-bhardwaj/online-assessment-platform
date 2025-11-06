import type { ReactNode } from "react"

import { AuthGuard } from "@/components/auth/auth-guard"
import { RoleGuard } from "@/components/auth/role-guard"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { adminNavItems } from "@/lib/navigation"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard allowed="admin">
        <DashboardShell
          title="Dashboard"
          subtitle="Configure organizations, manage platform operators, and monitor compliance"
          navItems={adminNavItems}
          ctaLabel="Organization settings"
          ctaHref="/admin/organizations"
        >
          {children}
        </DashboardShell>
      </RoleGuard>
    </AuthGuard>
  )
}
