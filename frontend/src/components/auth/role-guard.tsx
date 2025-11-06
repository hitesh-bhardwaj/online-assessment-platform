"use client"

import { useMemo, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserRole } from "@/lib/navigation"
import { useAuth } from "@/lib/auth-context"

interface RoleGuardProps {
  allowed: UserRole | UserRole[]
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
}

export function RoleGuard({ allowed, children, fallback, redirectTo }: RoleGuardProps) {
  const { status, role, defaultRoute, user } = useAuth()
  const router = useRouter()

  const allowedRoles = useMemo(() => (Array.isArray(allowed) ? allowed : [allowed]), [allowed])

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Preparing your workspace…</span>
        </div>
      </div>
    )
  }

  if (status !== "authenticated") {
    return null
  }

  if (!allowedRoles.includes(role)) {
    if (fallback) {
      return <>{fallback}</>
    }

    const destination = redirectTo ?? defaultRoute

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/70 text-center">
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>
              {user?.name ? `${user.name},` : "You"} don&apos;t have permission to view this area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your current role <span className="font-medium">{role}</span> can continue from the main dashboard instead.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button size="sm" onClick={() => router.replace(destination)}>
              Go to dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
