import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface ProfileResponse {
  success: boolean
  data: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    permissions: string[]
    organization?: {
      _id?: string
      id?: string
      name?: string
      domain?: string
    }
  }
}

interface UpdateProfilePayload {
  firstName?: string
  lastName?: string
}

export async function GET() {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const profile = await backendRequest<ProfileResponse>("/auth/profile", {
      method: "GET",
      token: accessToken,
    })

    return NextResponse.json(profile.data)
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

  let payload: UpdateProfilePayload
  try {
    payload = (await request.json()) as UpdateProfilePayload
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    await backendRequest("/auth/profile", {
      method: "PUT",
      token: accessToken,
      json: payload,
    })

    const profile = await backendRequest<ProfileResponse>("/auth/profile", {
      method: "GET",
      token: accessToken,
    })

    return NextResponse.json(profile.data)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
