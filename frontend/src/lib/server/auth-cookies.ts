import "server-only"

import { cookies } from "next/headers"

type CookieValue = string | undefined

type SetAuthCookiesParams = {
  accessToken: string
  refreshToken: string
  accessTokenMaxAge: number
  refreshTokenMaxAge: number
}

const ACCESS_COOKIE = "oap.access-token"
const REFRESH_COOKIE = "oap.refresh-token"

const isProd = process.env.NODE_ENV === "production"

export async function getAuthCookies(): Promise<{ accessToken: CookieValue; refreshToken: CookieValue }> {
  const store = await cookies()
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  }
}

export async function setAuthCookies({
  accessToken,
  refreshToken,
  accessTokenMaxAge,
  refreshTokenMaxAge,
}: SetAuthCookiesParams): Promise<void> {
  const store = await cookies()
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: accessTokenMaxAge,
    path: "/",
  })

  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: refreshTokenMaxAge,
    path: "/",
  })
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies()
  store.delete(ACCESS_COOKIE)
  store.delete(REFRESH_COOKIE)
}

export { ACCESS_COOKIE, REFRESH_COOKIE }
