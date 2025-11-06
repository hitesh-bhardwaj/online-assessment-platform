import { NextRequest, NextResponse } from "next/server"

import type { ResultSummary } from "@/lib/recruiter-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import {
  toResultSummary,
  toPaginationMeta,
  type BackendResultsResponse,
  type PaginatedResponse,
} from "../helpers"

function toQuery(searchParams: URLSearchParams) {
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
    const query = toQuery(searchParams)
    const page = Number(searchParams.get("page") ?? "1")
    const limit = Number(searchParams.get("limit") ?? "100")
    const response = await backendRequest<BackendResultsResponse>(`/results?${query}`, {
      method: "GET",
      token: accessToken,
    })

    const summaries = response.data.results.map(toResultSummary)
    const payload: PaginatedResponse<ResultSummary> = {
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

export const dynamic = "force-dynamic"
