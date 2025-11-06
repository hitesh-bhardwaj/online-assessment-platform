import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

type BackendAssessmentResponse<T = unknown> = {
  success: boolean
  message?: string
  data: T
}

type BackendAssessmentMutationResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_: NextRequest, { params }: RouteParams) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  try {
    const response = await backendRequest<BackendAssessmentResponse>(`/assessments/${id}`, {
      method: "GET",
      token: accessToken,
    })

    return NextResponse.json(response.data)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const payload = await request.json().catch(() => undefined)

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    const response = await backendRequest<BackendAssessmentMutationResponse>(`/assessments/${id}`, {
      method: "PUT",
      token: accessToken,
      json: payload,
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

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  try {
    const response = await backendRequest<BackendAssessmentMutationResponse>(`/assessments/${id}`, {
      method: "DELETE",
      token: accessToken,
    })

    return NextResponse.json(response.data)
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
