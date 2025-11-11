import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import { toAdminUserRecord, type BackendUser } from "../helpers"

export const dynamic = "force-dynamic"

interface UpdateUserResponse {
  success: boolean
  message: string
  data: BackendUser
}

type UpdateUserPayload = Partial<{
  email: string
  password: string
  firstName: string
  lastName: string
  role: "admin" | "recruiter"
  isActive: boolean
  status: "active" | "suspended"
  permissions: Record<string, unknown>
}>

interface UpdateStatusPayload {
  status?: "active" | "suspended" | "invited"
}

/**
 * FULL UPDATE -> proxies PUT /users/:id
 * Accepts name, email, password, role, permissions, status/isActive
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const userId = params.userId
  if (!userId) {
    return NextResponse.json({ success: false, message: "Missing userId" }, { status: 400 })
  }

  let body: UpdateUserPayload
  try {
    body = (await request.json()) as UpdateUserPayload
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  // Normalize common fields
  const payload: UpdateUserPayload = { ...body }
  if (payload.email) payload.email = payload.email.trim().toLowerCase()
  if (payload.firstName) payload.firstName = payload.firstName.trim()
  if (payload.lastName) payload.lastName = payload.lastName.trim()

  try {
    const response = await backendRequest<UpdateUserResponse>(`/users/${userId}`, {
      method: "PUT",
      token: accessToken,
      json: payload,
    })

    // Your backend returns { success, message, data }; unify to AdminUserRecord
    const record = toAdminUserRecord(response.data)
    return NextResponse.json(record, { status: 200 })
  } catch (error: unknown) {
    if (error instanceof BackendError) {
      // Surface 409 duplicate-email nicely to the UI
      const status = error.status ?? 500
      return NextResponse.json({ success: false, message: error.message }, { status })
    }
    throw error
  }
}

/**
 * STATUS UPDATE (toggle active/suspended) -> backend expects PUT /users/:id with { isActive }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const userId = params.userId
  if (!userId) {
    return NextResponse.json({ success: false, message: "Missing userId" }, { status: 400 })
  }

  let payload: UpdateStatusPayload
  try {
    payload = (await request.json()) as UpdateStatusPayload
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  const status = payload.status
  if (status !== "active" && status !== "suspended") {
    return NextResponse.json({ success: false, message: "Unsupported status update" }, { status: 400 })
  }

  const isActive = status === "active"

  try {
    const response = await backendRequest<UpdateUserResponse>(`/users/${userId}`, {
      method: "PUT",
      token: accessToken,
      json: { isActive },
    })

    const record = toAdminUserRecord(response.data)
    return NextResponse.json(record, { status: 200 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status ?? 500 })
    }
    throw error
  }
}

/**
 * HARD DELETE -> proxies DELETE /users/:id
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const userId = params.userId
  if (!userId) {
    return NextResponse.json({ success: false, message: "Missing userId" }, { status: 400 })
  }

  try {
    await backendRequest<void>(`/users/${userId}`, {
      method: "DELETE",
      token: accessToken,
    })
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status ?? 500 })
    }
    throw error
  }
}
