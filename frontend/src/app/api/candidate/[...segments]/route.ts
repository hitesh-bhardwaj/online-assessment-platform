import { NextRequest, NextResponse } from "next/server"

import { backendRequest, BackendError } from "@/lib/server/backend-client"

function buildCandidatePath(segments: string[] | undefined, search: string) {
  const pathSegments = ["candidate", ...(segments ?? [])]
  const normalized = `/${pathSegments.filter(Boolean).join("/")}`.replace(/\/{2,}/g, "/")
  return `${normalized}${search}`
}

async function readPayload(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return { jsonBody: undefined as unknown, rawBody: undefined as string | undefined }
  }
  const contentType = request.headers.get("content-type") ?? undefined
  if (contentType?.includes("application/json")) {
    const jsonBody = await request.json().catch(() => undefined)
    return { jsonBody, rawBody: undefined }
  }
  const rawBody = await request.text().catch(() => undefined)
  return { jsonBody: undefined, rawBody }
}

async function handler(request: NextRequest, { params }: { params: Promise<{ segments?: string[] }> }) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, message: "Candidate token is required" }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const resolvedParams = await params
  const path = buildCandidatePath(resolvedParams.segments, request.nextUrl.search ?? "")
  const payload = await readPayload(request)

  try {
    const response = await backendRequest<unknown>(path, {
      method: request.method,
      token,
      ...(payload.jsonBody !== undefined ? { json: payload.jsonBody } : {}),
      ...(payload.rawBody !== undefined ? {
        body: payload.rawBody,
        headers: request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type") ?? undefined } : undefined,
      } : {}),
    })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message, details: error.data }, { status: error.status })
    }
    throw error
  }
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler

export const dynamic = "force-dynamic"
