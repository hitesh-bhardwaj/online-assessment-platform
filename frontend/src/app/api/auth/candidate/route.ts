import { NextRequest, NextResponse } from "next/server"

import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface BackendCandidateAuthResponse {
  success: boolean
  message: string
  data: {
    token: string
    expiresIn: string | number
    candidate: {
      firstName?: string
      lastName?: string
      email: string
      position?: string
    }
    session: {
      invitationId: string
      assessmentId: string
      status: string
      validFrom?: string
      validUntil?: string
      attemptsUsed: number
      remindersSent: number
      lastReminderAt?: string
    }
    assessment: unknown
    organization: unknown
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    const response = await backendRequest<BackendCandidateAuthResponse>("/auth/candidate", {
      method: "POST",
      json: payload,
    })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          details: error.data,
        },
        { status: error.status }
      )
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
