import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { backendRequest, BackendError } from "@/lib/server/backend-client"

interface BackendMetadataResponse {
  success: boolean
  data: {
    categories: string[]
    tags: string[]
  }
}

export async function GET() {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  try {
    const response = await backendRequest<BackendMetadataResponse>("/questions/metadata", {
      method: "GET",
      token: accessToken,
    })
    return NextResponse.json(response.data)
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    throw error
  }
}

// Rename category across all questions: body { from: string, to: string }
export async function PATCH(request: NextRequest) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { from?: string; to?: string } | null
  if (!body || !body.from || !body.to) {
    return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 })
  }

  try {
    // 1) fetch all questions with the source category
    const search = new URLSearchParams({ category: body.from, limit: "500" })
    const list = await backendRequest<{ success: boolean; data: { questions: Array<{ _id: string; category?: string }> } }>(
      `/questions?${search.toString()}`,
      { method: "GET", token: accessToken }
    )

    const questions = list.data.questions
    // 2) update each question with new category value
    for (const q of questions) {
      await backendRequest(`/questions/${q._id}`, {
        method: "PUT",
        token: accessToken,
        json: { category: body.to },
      })
    }

    return NextResponse.json({ success: true, updated: questions.length })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    throw error
  }
}

// Delete a category by clearing it on all questions: body { category: string }
export async function DELETE(request: NextRequest) {
  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { category?: string } | null
  if (!body || !body.category) {
    return NextResponse.json({ success: false, message: "category is required" }, { status: 400 })
  }

  try {
    const search = new URLSearchParams({ category: body.category, limit: "500" })
    const list = await backendRequest<{ success: boolean; data: { questions: Array<{ _id: string; category?: string }> } }>(
      `/questions?${search.toString()}`,
      { method: "GET", token: accessToken }
    )

    const questions = list.data.questions
    for (const q of questions) {
      await backendRequest(`/questions/${q._id}`, {
        method: "PUT",
        token: accessToken,
        json: { category: "" },
      })
    }

    return NextResponse.json({ success: true, updated: questions.length })
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    throw error
  }
}

export const dynamic = "force-dynamic"

