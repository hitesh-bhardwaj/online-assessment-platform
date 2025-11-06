import "server-only"

import { NextRequest, NextResponse } from "next/server"

import { clearAuthCookies, getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"
import { refreshAccessToken } from "@/lib/server/token-service"

type RouteParams = {
  segments?: string[]
}

type BuildTargetPath = (segments: string[] | undefined, search: string) => string

type ForwardResponse = NextResponse<unknown>

type ProxyHandler = (request: NextRequest, context: { params: RouteParams }) => Promise<ForwardResponse>

async function readRequestPayload(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return { jsonBody: undefined, rawBody: undefined, contentType: undefined }
  }

  const contentType = request.headers.get("content-type") ?? undefined

  if (contentType?.includes("application/json")) {
    const jsonBody = await request.json().catch(() => undefined)
    return { jsonBody, rawBody: undefined, contentType }
  }

  const rawBody = await request.text().catch(() => undefined)
  return { jsonBody: undefined, rawBody, contentType }
}

export function createProxyHandler(buildTargetPath: BuildTargetPath): ProxyHandler {
  return async function proxyHandler(request, context) {
    const { accessToken, refreshToken } = await getAuthCookies()
    const search = request.nextUrl.search ?? ""
    const path = buildTargetPath(context.params.segments, search)

    if (!accessToken) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
    }

    const payload = await readRequestPayload(request)

    const forward = async (token: string) => {
      const result = await backendRequest<unknown>(path, {
        method: request.method,
        token,
        ...(payload.jsonBody !== undefined
          ? { json: payload.jsonBody }
          : payload.rawBody !== undefined
            ? {
                body: payload.rawBody,
                headers: payload.contentType ? { "Content-Type": payload.contentType } : undefined,
              }
            : {}),
      })

      return NextResponse.json(result)
    }

    try {
      return await forward(accessToken)
    } catch (error) {
      if (!(error instanceof BackendError)) {
        throw error
      }

      if (error.status === 401 && refreshToken) {
        try {
          const { token } = await refreshAccessToken(accessToken, refreshToken)
          return await forward(token)
        } catch (refreshError) {
          if (refreshError instanceof BackendError) {
            await clearAuthCookies()
            return NextResponse.json(
              { success: false, message: refreshError.message, details: refreshError.data },
              { status: refreshError.status }
            )
          }
          throw refreshError
        }
      }

      if (error.status === 401) {
        await clearAuthCookies()
      }

      return NextResponse.json(
        { success: false, message: error.message, details: error.data },
        { status: error.status }
      )
    }
  }
}
