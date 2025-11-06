import { NextRequest, NextResponse } from "next/server"

import type { InvitationDetail } from "@/lib/recruiter-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface BackendInvitationDetailResponse {
  success: boolean
  data: {
    _id: string
    candidate: {
      firstName: string
      lastName: string
      email: string
      phone?: string
      resumeUrl?: string
      position?: string
    }
    assessmentId: {
      _id: string
      title: string
      type: "mcq" | "coding" | "mixed"
      settings?: {
        durationMinutes?: number
      }
      questions?: Array<unknown>
    }
    status: "pending" | "started" | "submitted" | "expired" | "cancelled"
    validFrom?: string
    validUntil?: string
    customMessage?: string
    createdAt?: string
    updatedAt?: string
    startedAt?: string
    submittedAt?: string
    token: string
  }
}

function toInvitationDetail(response: BackendInvitationDetailResponse["data"]): InvitationDetail {
  return {
    id: response._id,
    candidate: {
      firstName: response.candidate.firstName,
      lastName: response.candidate.lastName,
      email: response.candidate.email,
      phone: response.candidate.phone,
      resumeUrl: response.candidate.resumeUrl,
      position: response.candidate.position,
    },
    assessment: {
      id: response.assessmentId._id,
      title: response.assessmentId.title,
      type: response.assessmentId.type,
      durationMinutes: response.assessmentId.settings?.durationMinutes ?? 0,
      questions: response.assessmentId.questions?.length ?? 0,
    },
    status: response.status,
    validFrom: response.validFrom ?? response.createdAt ?? new Date().toISOString(),
    validUntil: response.validUntil ?? new Date().toISOString(),
    customMessage: response.customMessage,
    createdAt: response.createdAt ?? new Date().toISOString(),
    updatedAt: response.updatedAt ?? new Date().toISOString(),
    startedAt: response.startedAt,
    submittedAt: response.submittedAt,
    token: response.token,
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const invitationId = params.id

  try {
    const response = await backendRequest<BackendInvitationDetailResponse>(`/invitations/${invitationId}`, {
      method: "GET",
      token: accessToken,
    })

    const detail = toInvitationDetail(response.data)
    return NextResponse.json(detail, { status: 200 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"
