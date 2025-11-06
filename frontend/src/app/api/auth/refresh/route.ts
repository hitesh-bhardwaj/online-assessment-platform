import { NextResponse } from "next/server"

import { clearAuthCookies, getAuthCookies } from "@/lib/server/auth-cookies"
import { BackendError } from "@/lib/server/backend-client"
import { refreshAccessToken } from "@/lib/server/token-service"

export async function POST() {
  const { accessToken, refreshToken } = await getAuthCookies()

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ success: false, message: "Missing tokens" }, { status: 400 })
  }

  try {
    const { accessTokenMaxAge } = await refreshAccessToken(accessToken, refreshToken)
    return NextResponse.json({ success: true, data: { tokenExpiresIn: accessTokenMaxAge } })
  } catch (error) {
    await clearAuthCookies()

    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
