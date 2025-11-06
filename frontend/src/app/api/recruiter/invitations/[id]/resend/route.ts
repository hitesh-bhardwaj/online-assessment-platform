import { NextRequest, NextResponse } from "next/server"

import type { InvitationSummary } from "@/lib/recruiter-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"
import { toInvitationSummary } from "../../../helpers"

interface BackendResendResponse {
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
    const response = await backendRequest<BackendResendResponse>(`/invitations/${invitationId}/resend`, {
      method: "POST",
      token: accessToken,
    })

    const summary: InvitationSummary | undefined = response.data ? toInvitationSummary(response.data) : undefined

    return NextResponse.json(
      {
        success: response.success,
        message: response.message,
        data: summary,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, data: error.data }, { status: error.status })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"
