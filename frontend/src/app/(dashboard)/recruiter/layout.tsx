import type { ReactNode } from "react"

import { AuthGuard } from "@/components/auth/auth-guard"
import { RoleGuard } from "@/components/auth/role-guard"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { recruiterNavItems } from "@/lib/navigation"

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard allowed="recruiter">
        <DashboardShell
          title="Dashboard"
          subtitle="Build assessments, invite candidates, and analyze outcomes"
          navItems={recruiterNavItems}
          ctaLabel="New assessment"
          ctaHref="/recruiter/assessments/new"
        >
          {children}
        </DashboardShell>
      </RoleGuard>
    </AuthGuard>
  )
}
