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

    if (!query.has("limit")) {
      query.set("limit", "20")
    }

    if (!query.has("page")) {
      query.set("page", "1")
    }

    const response = await backendRequest<UsersResponse>(`/users?${query.toString()}`, {
      method: "GET",
      token: accessToken,
    })

    const summaries = mapUsers(response.data.users)

    return NextResponse.json({
      items: summaries,
      pagination:
        response.data.pagination ?? {
          page: Number(query.get("page") ?? 1),
          limit: Number(query.get("limit") ?? summaries.length),
          total: summaries.length,
          pages: 1,
        },
    })
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
    return NextResponse.json({ success: false, message: "Password must be at least 8 characters" }, { status: 400 })
  }

  if (role !== "admin" && role !== "recruiter") {
    return NextResponse.json({ success: false, message: "Role must be admin or recruiter" }, { status: 400 })
  }

  try {
    const response = await backendRequest<CreateUserResponse>("/users", {
      method: "POST",
      token: accessToken,
      json: {
        email,
        password,
        firstName,
        lastName,
        role,
      },
    })

    const record = toAdminUserRecord(response.data)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
