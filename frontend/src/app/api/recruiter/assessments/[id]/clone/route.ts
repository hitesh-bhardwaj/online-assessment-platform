import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

type BackendAssessmentMutationResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_: NextRequest, { params }: RouteParams) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  try {
    const response = await backendRequest<BackendAssessmentMutationResponse>(`/assessments/${id}/clone`, {
      method: "POST",
      token: accessToken,
    })

    return NextResponse.json(response.data ?? { success: response.success, message: response.message })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json(
        { success: false, message: error.message, details: error.data },
        { status: error.status }
      )
    }

    throw error
  }
}

export const dynamic = "force-dynamic"