import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"
import { toPaginationMeta, type PaginatedResponse } from "../helpers"

import { mapQuestionPayload, type QuestionPayload } from "./utils"

interface BackendQuestionsResponse {
  success: boolean
  data: {
    questions: QuestionPayload[]
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

interface CreateQuestionResponse {
  success: boolean
  data: QuestionPayload
}

export async function GET(request: NextRequest) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const query = new URLSearchParams(params)
    if (!query.has("limit")) {
      query.set("limit", "100")
    }

    const response = await backendRequest<BackendQuestionsResponse>(`/questions?${query.toString()}`, {
      method: "GET",
      token: accessToken,
    })

    const page = Number(params.get("page") ?? "1")
    const limit = Number(params.get("limit") ?? "100")

    const items = Array.isArray(response?.data?.questions) ? response.data.questions : []
    const mapped = items.map(mapQuestionPayload)
    const payload: PaginatedResponse<ReturnType<typeof mapQuestionPayload>> = {
      items: mapped,
      pagination: toPaginationMeta(response.data.pagination, mapped.length, page, limit),
    }
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export async function POST(request: NextRequest) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    const response = await backendRequest<CreateQuestionResponse>("/questions", {
      method: "POST",
      token: accessToken,
      json: payload,
    })

    return NextResponse.json(mapQuestionPayload(response.data), { status: 201 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, details: error.data }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
