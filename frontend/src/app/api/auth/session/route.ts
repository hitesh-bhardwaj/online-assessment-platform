import { NextResponse } from "next/server"

import { clearAuthCookies, getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"
import { refreshAccessToken } from "@/lib/server/token-service"

interface BackendProfileResponse {
  success: boolean
  data: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    permissions: string[]
    lastLogin?: string
    organization?: {
      _id?: string
      id?: string
      name?: string
      domain?: string
      branding?: unknown
    }
  }
}

async function fetchProfile(accessToken: string) {
  const profile = await backendRequest<BackendProfileResponse>("/auth/profile", {
    method: "GET",
    token: accessToken,
  })

  return profile.data
}

export async function GET() {
  const { accessToken, refreshToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const profile = await fetchProfile(accessToken)
    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    if (!(error instanceof BackendError)) {
      throw error
    }

    if (error.status !== 401 || !refreshToken) {
      await clearAuthCookies()
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    try {
      const { token } = await refreshAccessToken(accessToken, refreshToken)
      const profile = await fetchProfile(token)
      return NextResponse.json({ success: true, data: profile })
    } catch (refreshError) {
      await clearAuthCookies()

      if (refreshError instanceof BackendError) {
        return NextResponse.json(
          { success: false, message: refreshError.message },
          { status: refreshError.status }
        )
      }

      throw refreshError
    }
  }
}

export const dynamic = "force-dynamic"
