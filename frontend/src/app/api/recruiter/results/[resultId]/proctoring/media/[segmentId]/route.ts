import { NextRequest, NextResponse } from "next/server"

import { getAuthCookies } from "@/lib/server/auth-cookies"
import { getBackendBaseUrl } from "@/lib/server/backend-client"

interface Params {
  resultId: string
  segmentId: string
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { accessToken } = await getAuthCookies()

  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
  }

  const backendUrl = `${getBackendBaseUrl()}/results/${params.resultId}/proctoring/media/${params.segmentId}`

  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  })

  const rangeHeader = request.headers.get("range")
  if (rangeHeader) {
    headers.set("Range", rangeHeader)
  }

  const backendResponse = await fetch(backendUrl, {
    method: "GET",
    headers,
  })

  const responseHeaders = new Headers()
  backendResponse.headers.forEach((value, key) => {
    responseHeaders.set(key, value)
  })

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  })
}

export const dynamic = "force-dynamic"
