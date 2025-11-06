import { NextRequest, NextResponse } from "next/server"

import type { AssessmentSummary } from "@/lib/recruiter-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import {
  toAssessmentSummary,
  toPaginationMeta,
  type BackendAssessmentsResponse,
  type PaginatedResponse,
} from "../helpers"

function toQueryParams(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams)
  if (!params.has("limit")) params.set("limit", "100")
  return params.toString()
}

export async function GET(request: NextRequest) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const query = toQueryParams(searchParams)
    const page = Number(searchParams.get("page") ?? "1")
    const limit = Number(searchParams.get("limit") ?? "100")

    const response = await backendRequest<BackendAssessmentsResponse>(`/assessments?${query}`, {
      method: "GET",
      token: accessToken,
    })

    const summaries = response.data.assessments.map(toAssessmentSummary)
    const payload: PaginatedResponse<AssessmentSummary> = {
      items: summaries,
      pagination: toPaginationMeta(response.data.pagination, summaries.length, page, limit),
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

  const payload = await request.json().catch(() => undefined)

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    const response = await backendRequest<{ success: boolean; data: unknown }>("/assessments", {
      method: "POST",
      token: accessToken,
      json: payload,
    })

    return NextResponse.json(response.data, { status: 201 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, details: error.data }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
