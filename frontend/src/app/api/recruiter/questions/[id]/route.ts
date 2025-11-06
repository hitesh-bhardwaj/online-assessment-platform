import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import { mapQuestionPayload, type QuestionPayload } from "../utils"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  try {
    const response = await backendRequest<{ success: boolean; data: QuestionPayload }>(`/questions/${id}`, {
      method: "GET",
      token: accessToken,
    })

    return NextResponse.json(mapQuestionPayload(response.data))
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const response = await backendRequest<{ success: boolean; data: QuestionPayload }>(`/questions/${id}`, {
      method: "PUT",
      token: accessToken,
      json: payload,
    })

    return NextResponse.json(mapQuestionPayload(response.data))
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, details: error.data }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
