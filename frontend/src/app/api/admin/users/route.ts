import { NextRequest, NextResponse } from "next/server"

import type { AdminUserRecord } from "@/lib/admin-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import { toAdminUserRecord, type BackendUser } from "./helpers"

interface UsersResponse {
  success: boolean
  data: {
    users: BackendUser[]
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

interface CreateUserResponse {
  success: boolean
  message: string
  data: BackendUser
}

interface CreateUserPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: "admin" | "recruiter"
}

function mapUsers(users: BackendUser[]): AdminUserRecord[] {
  return users.map((u) => toAdminUserRecord(u))
}

export async function GET(request: NextRequest) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const sp = request.nextUrl.searchParams

    // UI filters
    const role = sp.get("role") as "admin" | "recruiter" | null
    const status = sp.get("status") as "active" | "invited" | "suspended" | null
    const search = (sp.get("search") || "").trim().toLowerCase()
    const page = Math.max(1, Number(sp.get("page") ?? "1"))
    const limit = Math.max(1, Number(sp.get("limit") ?? "20"))

    // ✅ Map UI filters to backend query (no hard exclusion)
    const backendQuery = new URLSearchParams()
    backendQuery.set("page", String(page))
    backendQuery.set("limit", String(limit))

    // map status to isActive when explicitly chosen
    if (status === "active") backendQuery.set("isActive", "true")
    else if (status === "suspended") backendQuery.set("isActive", "false")
    // when “all”, send nothing so both show

    const response = await backendRequest<UsersResponse>(`/users?${backendQuery.toString()}`, {
      method: "GET",
      token: accessToken,
    })

    const raw = response.data.users ?? []

    // ✅ Keep all users, even suspended. Only hide deleted ones.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visibleRaw = raw.filter((u: any) => !u?.deletedAt && !u?.isDeleted)

    // Map to UI shape
    let items = mapUsers(visibleRaw)

    // Apply client-side filters
    if (role) items = items.filter((u) => u.role === role)
    if (status) items = items.filter((u) => u.status === status)
    if (search) {
      items = items.filter((u) => {
        const hay = `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase()
        return hay.includes(search)
      })
    }

    const backendPg = response.data.pagination
    const pagination = backendPg
      ? backendPg
      : {
          page,
          limit,
          total: items.length,
          pages: Math.max(1, Math.ceil(Math.max(items.length, 1) / limit)),
        }

    return NextResponse.json({ items, pagination }, { status: 200 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status ?? 500 }
      )
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  let payload: Partial<CreateUserPayload>
  try {
    payload = (await request.json()) as Partial<CreateUserPayload>
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  const email = payload.email?.trim().toLowerCase()
  const password = payload.password ?? ""
  const firstName = payload.firstName?.trim()
  const lastName = payload.lastName?.trim()
  const role = payload.role ?? "recruiter"

  if (!email || !email.includes("@")) {
    return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 })
  }
  if (!firstName) {
    return NextResponse.json({ success: false, message: "First name is required" }, { status: 400 })
  }
  if (!lastName) {
    return NextResponse.json({ success: false, message: "Last name is required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { success: false, message: "Password must be at least 8 characters" },
      { status: 400 }
    )
  }
  if (role !== "admin" && role !== "recruiter") {
    return NextResponse.json(
      { success: false, message: "Role must be admin or recruiter" },
      { status: 400 }
    )
  }

  try {
    const response = await backendRequest<CreateUserResponse>("/users", {
      method: "POST",
      token: accessToken,
      json: { email, password, firstName, lastName, role },
    })

    const record = toAdminUserRecord(response.data)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    if (error instanceof BackendError) {
      const message =
        error.status === 409 || /exists/i.test(error.message)
          ? "User with this email already exists in your organization"
          : error.message
      const status = error.status === 409 || /exists/i.test(error.message) ? 409 : error.status
      return NextResponse.json({ success: false, message }, { status })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"
