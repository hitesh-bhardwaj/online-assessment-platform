import { NextResponse } from "next/server"

import { clearAuthCookies, getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

export async function POST() {
  const { accessToken } = await getAuthCookies()
  let backendMessage: string | undefined

  if (accessToken) {
    try {
      const response = await backendRequest<{ success: boolean; message?: string }>("/auth/logout", {
        method: "POST",
        token: accessToken,
      })
      backendMessage = response?.message
    } catch (error) {
      if (error instanceof BackendError && error.status !== 401) {
        backendMessage = error.message
      }
    }
  }

  await clearAuthCookies()

  return NextResponse.json({ success: true, message: backendMessage ?? "Logged out" })
}

export const dynamic = "force-dynamic"
