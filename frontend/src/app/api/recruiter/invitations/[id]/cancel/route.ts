import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface BackendCancelResponse {
  success: boolean
  message: string
  data?: unknown
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const invitationId = params.id

  try {
    const response = await backendRequest<BackendCancelResponse>(`/invitations/${invitationId}/cancel`, {
      method: "POST",
      token: accessToken,
    })

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, data: error.data }, { status: error.status })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"
