import "server-only"

import { setAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest } from "@/lib/server/backend-client"

interface BackendRefreshResponse {
  success: boolean
  data: {
    token: string
    refreshToken: string
    expiresIn: string | number
  }
}

export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7
const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24

export function parseExpiresIn(expiresIn: string | number | undefined): number {
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

export async function refreshAccessToken(accessToken: string, refreshToken: string) {
  const response = await backendRequest<BackendRefreshResponse>("/auth/refresh", {
    method: "POST",
    token: accessToken,
    json: { refreshToken },
  })

  const { token, refreshToken: nextRefreshToken, expiresIn } = response.data
  const accessTokenMaxAge = parseExpiresIn(expiresIn)

  await setAuthCookies({
    accessToken: token,
    refreshToken: nextRefreshToken,
    accessTokenMaxAge,
    refreshTokenMaxAge: REFRESH_TOKEN_MAX_AGE,
  })

  return { token, accessTokenMaxAge }
}
