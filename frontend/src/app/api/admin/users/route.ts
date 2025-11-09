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
  return users.map((user) => toAdminUserRecord(user))
}

export async function GET(request: NextRequest) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const query = new URLSearchParams(searchParams)

    if (!query.has("limit")) query.set("limit", "20")
    if (!query.has("page")) query.set("page", "1")

    const response = await backendRequest<UsersResponse>(`/users?${query.toString()}`, {
      method: "GET",
      token: accessToken,
    })

    const items = mapUsers(response.data.users)
    const pagination =
      response.data.pagination ?? {
        page: Number(query.get("page") ?? 1),
        limit: Number(query.get("limit") ??( items.length || 10)),
        total: items.length,
        pages: Math.max(1, Math.ceil((items.length || 1) / Number(query.get("limit") ?? 10))),
      }

    return NextResponse.json({ items, pagination }, { status: 200 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
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
    return NextResponse.json({ success: false, message: "Role must be admin or recruiter" }, { status: 400 })
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
      // normalize “already exists” to 409 for the UI
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
