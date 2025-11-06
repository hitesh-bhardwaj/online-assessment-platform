import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"
import {
  toProctoringDetails,
  type BackendProctoringDetailsResponse,
  type RecruiterProctoringDetails,
} from "@/app/api/recruiter/helpers"

interface Params {
  resultId: string
}

export async function GET(_: NextRequest, { params }: { params: Params }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const response = await backendRequest<BackendProctoringDetailsResponse>(`/results/${params.resultId}/proctoring`, {
      method: "GET",
      token: accessToken,
    })

    if (!response.success) {
      return NextResponse.json({ success: false, message: "Unable to load proctoring data" }, { status: 502 })
    }

    const details = toProctoringDetails(response.data)
    return NextResponse.json<{ success: true; data: RecruiterProctoringDetails }>({
      success: true,
      data: details,
    })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
