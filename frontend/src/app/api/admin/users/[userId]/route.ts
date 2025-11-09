import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import { toAdminUserRecord, type BackendUser } from "../helpers"

interface UpdateUserResponse {
  success: boolean
  message: string
  data: BackendUser
}

interface UpdateStatusPayload {
  status?: "active" | "suspended" | "invited"
}

/**
 * Update status -> backend expects PUT /users/:id with { isActive }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userid: string } }
) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const userId = params.userid
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
 * Hard delete user -> proxies DELETE /users/:id
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userid: string } }
) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const userId = params.userid
  if (!userId) {
    return NextResponse.json({ success: false, message: "Missing userId" }, { status: 400 })
  }

  try {
    await backendRequest<void>(`/users/${userId}`, {
      method: "DELETE",
      token: accessToken,
    })
    // No body on successful delete
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status ?? 500 })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"
