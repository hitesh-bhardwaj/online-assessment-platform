"use client"

import { createContext, useCallback, useContext, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import type { UserRole } from "@/lib/navigation"

export type OrganizationPlan = "free" | "basic" | "premium"

export interface OrganizationSummary {
  id: string
  name: string
  plan?: OrganizationPlan
  seatLimit?: number
  domain?: string
}

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  initials: string
  role: UserRole
  organization?: OrganizationSummary
  permissions: string[]
  lastLogin?: string
}

interface BackendProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  permissions: string[]
  lastLogin?: string
  organization?: {
    id?: string
    _id?: string
    name?: string
    domain?: string
    plan?: OrganizationPlan
    seatLimit?: number
  }
}

interface AuthContextValue {
  user: AuthenticatedUser | null
  role: UserRole
  permissions: string[]
  defaultRoute: string
  status: "loading" | "authenticated" | "unauthenticated"
  error?: string
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  requestOtp: (email: string) => Promise<string>
  loginWithOtp: (input: OtpLoginInput) => Promise<void>
}

interface LoginInput {
  email: string
  password: string
  organizationDomain?: string
}

interface OtpLoginInput {
  email: string
  code: string
  organizationDomain?: string
}

interface SessionResponse {
  success: boolean
  data?: BackendProfile | null
  message?: string
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchSession(): Promise<BackendProfile | null> {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  let payload: SessionResponse | undefined
  try {
    payload = (await response.json()) as SessionResponse
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    if (response.status === 401) {
      return null
    }
    throw new Error(payload?.message ?? "Failed to load session")
  }

  return payload?.data ?? null
}

function composeUser(profile: BackendProfile | null): AuthenticatedUser | null {
  if (!profile) return null

  const firstName = profile.firstName?.trim()
  const lastName = profile.lastName?.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || profile.email

  const initials = [firstName?.[0], lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || profile.email.slice(0, 2).toUpperCase()

  const role = (profile.role as UserRole) ?? "admin"

  const organization = profile.organization
    ? {
        id: profile.organization.id ?? profile.organization._id ?? "",
        name: profile.organization.name ?? "Organization",
        domain: profile.organization.domain,
        plan: profile.organization.plan,
        seatLimit: profile.organization.seatLimit,
      }
    : undefined

  return {
    id: profile.id,
    email: profile.email,
    name: fullName,
    initials,
    role,
    organization,
    permissions: profile.permissions,
    lastLogin: profile.lastLogin,
  }
}

const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  recruiter: "/recruiter",
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery<BackendProfile | null, Error>({
    queryKey: ["auth", "session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "session"] })
  }, [queryClient])

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })

      const payload = await response.json().catch(() => undefined)

      if (!response.ok) {
        throw new Error(payload?.message ?? "Invalid credentials")
      }

      await refresh()
    },
    [refresh]
  )

  const requestOtp = useCallback(async (email: string) => {
    const response = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    const payload = await response.json().catch(() => undefined)

    if (!response.ok) {
      throw new Error(payload?.message ?? "Unable to send code")
    }

    return payload?.message ?? "Check your email for the one-time code."
  }, [])

  const loginWithOtp = useCallback(
    async (input: OtpLoginInput) => {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })

      const payload = await response.json().catch(() => undefined)

      if (!response.ok) {
        throw new Error(payload?.message ?? "Invalid or expired code")
      }

      await refresh()
    },
    [refresh]
  )

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })

    queryClient.setQueryData(["auth", "session"], null)
  }, [queryClient])

  const user = useMemo(() => composeUser(sessionQuery.data ?? null), [sessionQuery.data])
  const role = user?.role ?? "admin"
  const permissions = useMemo(() => user?.permissions ?? [], [user?.permissions])
  const defaultRoute = ROLE_HOME[role] ?? "/"

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      permissions,
      defaultRoute,
      status: sessionQuery.isLoading ? "loading" : user ? "authenticated" : "unauthenticated",
      error: sessionQuery.error?.message,
      login,
      loginWithOtp,
      logout,
      refresh,
      requestOtp,
    }),
    [
      defaultRoute,
      login,
      loginWithOtp,
      logout,
      permissions,
      refresh,
      requestOtp,
      role,
      sessionQuery.error?.message,
      sessionQuery.isLoading,
      user,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
