"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "unauthenticated") {
      const search = pathname ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/login${search}`)
    }
  }, [pathname, router, status])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Checking your session…</span>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return <>{children}</>
}
