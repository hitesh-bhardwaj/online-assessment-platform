import { NextRequest, NextResponse } from "next/server"

import type { InvitationSummary } from "@/lib/recruiter-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

import {
  toInvitationSummary,
  toPaginationMeta,
  type BackendInvitationsResponse,
  type PaginatedResponse,
} from "../helpers"

type CreateInvitationPayload = {
  assessmentId: string
  candidate: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    resumeUrl?: string
    position?: string
  }
  validFrom?: string
  validUntil: string
  customMessage?: string
}

type BackendCreateInvitationResponse = {
  success: boolean
  message: string
  data: unknown
}

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
    const response = await backendRequest<BackendInvitationsResponse>(`/invitations?${query}`, {
      method: "GET",
      token: accessToken,
    })

    const summaries = response.data.invitations.map(toInvitationSummary)
    const payload: PaginatedResponse<InvitationSummary> = {
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

  let payload: CreateInvitationPayload
  try {
    payload = (await request.json()) as CreateInvitationPayload
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    const response = await backendRequest<BackendCreateInvitationResponse>("/invitations", {
      method: "POST",
      token: accessToken,
      json: payload,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, data: error.data }, { status: error.status })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"
