import { NextRequest, NextResponse } from "next/server"

import { clearAuthCookies, setAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface BackendLoginResponse {
  success: boolean
  message: string
  data: {
    token: string
    refreshToken: string
    expiresIn: string | number
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: string
      permissions: string[]
      organization: {
        id: string
        name: string
        domain: string
      }
    }
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

export async function POST(request: NextRequest) {
  const credentials = await request.json().catch(() => null)

  if (!credentials || typeof credentials !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
  }

  try {
    const response = await backendRequest<BackendLoginResponse>("/auth/login", {
      method: "POST",
      json: credentials,
    })

    const { token, refreshToken, expiresIn, user } = response.data
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
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          details: error.data,
        },
        { status: error.status }
      )
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
