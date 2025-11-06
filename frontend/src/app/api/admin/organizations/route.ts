import { NextRequest, NextResponse } from "next/server"

import type { OrganizationRecord } from "@/lib/admin-data"
import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface OrganizationResponse {
  success: boolean
  data: {
    _id: string
    name: string
    domain?: string
    contactEmail?: string
    subscription?: {
      plan?: string
      features?: string[]
      maxAssessments?: number
      maxCandidatesPerMonth?: number
    }
    settings?: {
      dataRetentionDays?: number
      gdprCompliant?: boolean
    }
  }
}

interface UsageStatsResponse {
  success: boolean
  data: {
    users: number
    subscription?: {
      plan?: string
      features?: string[]
      limits?: {
        maxAssessments?: number
        maxCandidatesPerMonth?: number
      }
    }
  }
}

const PLAN_FALLBACK: OrganizationRecord["plan"] = "free"

function toOrganizationRecord(
  organization: OrganizationResponse["data"],
  usage: UsageStatsResponse["data"]
): OrganizationRecord {
  return {
    id: organization._id,
    name: organization.name,
    domain: organization.domain ?? "",
    plan: (organization.subscription?.plan as OrganizationRecord["plan"]) ?? PLAN_FALLBACK,
    seatsUsed: usage.users ?? 0,
    seatLimit:
      usage.subscription?.limits?.maxCandidatesPerMonth ?? usage.subscription?.limits?.maxAssessments ?? usage.users ?? 0,
    dataRetentionDays: organization.settings?.dataRetentionDays ?? 365,
    gdprCompliant: organization.settings?.gdprCompliant ?? false,
    primaryContact: organization.contactEmail ?? "",
  }
}

export async function GET() {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const [orgResponse, usageResponse] = await Promise.all([
      backendRequest<OrganizationResponse>("/organizations/current", {
        method: "GET",
        token: accessToken,
      }),
      backendRequest<UsageStatsResponse>("/organizations/usage-stats", {
        method: "GET",
        token: accessToken,
      }),
    ])

    const organization = orgResponse.data
    const usage = usageResponse.data

    const record = toOrganizationRecord(organization, usage)

    return NextResponse.json({
      organization,
      usage,
      summary: record,
    })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export async function PATCH(request: NextRequest) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const payload = await request.json().catch(() => undefined)

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    await backendRequest("/organizations/current", {
      method: "PUT",
      token: accessToken,
      json: payload,
    })

    // Refetch updated details
    const [orgResponse, usageResponse] = await Promise.all([
      backendRequest<OrganizationResponse>("/organizations/current", {
        method: "GET",
        token: accessToken,
      }),
      backendRequest<UsageStatsResponse>("/organizations/usage-stats", {
        method: "GET",
        token: accessToken,
      }),
    ])

    const organization = orgResponse.data
    const usage = usageResponse.data

    return NextResponse.json({
      organization,
      usage,
      summary: toOrganizationRecord(organization, usage),
    })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, details: error.data }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
