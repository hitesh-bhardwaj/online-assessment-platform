import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  try {
    const response = await backendRequest<{ success: boolean; message: string }>(`/assessments/${id}/unpublish`, {
      method: "POST",
      token: accessToken,
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
