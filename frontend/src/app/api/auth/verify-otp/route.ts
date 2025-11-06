import { NextResponse } from "next/server"

import { backendRequest, BackendError } from "@/lib/server/backend-client"
import { clearAuthCookies, setAuthCookies } from "@/lib/server/auth-cookies"

interface BackendResponse {
  success: boolean
  message: string
  data?: {
    token: string
    refreshToken: string
    expiresIn: string | number
    user: unknown
  }
}

const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7
const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24

function parseExpiresIn(expiresIn: string | number | undefined): number {
  if (!expiresIn) return DEFAULT_ACCESS_TOKEN_MAX_AGE
  if (typeof expiresIn === "number") return expiresIn

  const match = /^([0-9]+)([smhd])$/.exec(expiresIn.trim())
  if (!match) return DEFAULT_ACCESS_TOKEN_MAX_AGE

  const value = Number(match[1])
  const unit = match[2]

  switch (unit) {
    case "s":
      return value
    case "m":
      return value * 60
    case "h":
      return value * 60 * 60
    case "d":
      return value * 60 * 60 * 24
    default:
      return DEFAULT_ACCESS_TOKEN_MAX_AGE
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload.email !== "string" || typeof payload.code !== "string") {
    return NextResponse.json({ success: false, message: "Email and code are required" }, { status: 400 })
  }

  try {
    const response = await backendRequest<BackendResponse>("/auth/verify-otp", {
      method: "POST",
      json: payload,
    })
    const { token, refreshToken, expiresIn, user } = response.data ?? {}

    if (!token || !refreshToken) {
      return NextResponse.json({ success: false, message: "Invalid response from server" }, { status: 500 })
    }

    const accessTokenMaxAge = parseExpiresIn(expiresIn)

    await setAuthCookies({
      accessToken: token,
      refreshToken,
      accessTokenMaxAge,
      refreshTokenMaxAge: REFRESH_TOKEN_MAX_AGE,
    })

    return NextResponse.json({
      success: true,
      message: response.message,
      data: {
        user,
        tokenExpiresIn: accessTokenMaxAge,
      },
    })
  } catch (error) {
    await clearAuthCookies()

    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
