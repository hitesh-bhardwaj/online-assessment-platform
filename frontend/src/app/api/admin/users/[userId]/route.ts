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

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { userId } = await context.params

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
    return NextResponse.json(record)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
