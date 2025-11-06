import { NextResponse } from "next/server"

import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface BackendResponse {
  success: boolean
  message: string
  verificationToken?: string
  verificationLink?: string
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload.email !== "string") {
    return NextResponse.json({ success: false, message: "Missing required email" }, { status: 400 })
  }

  try {
    const response = await backendRequest<BackendResponse>("/signup/request-link", {
      method: "POST",
      json: payload,
    })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }

    throw error
  }
}

export const dynamic = "force-dynamic"
