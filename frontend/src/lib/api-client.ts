import axios, { AxiosError, AxiosRequestConfig } from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api"

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

export async function apiRequest<TResponse, TBody = unknown>(config: AxiosRequestConfig<TBody>): Promise<TResponse> {
  try {
    const response = await api.request<TResponse>(config)
    return response.data
  } catch (error) {
    throw normalizeAxiosError(error)
  }
}

function normalizeAxiosError(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message ?? error.message
    return Object.assign(new Error(message), {
      status: error.response?.status,
      details: error.response?.data,
    })
  }
  return error instanceof Error ? error : new Error("Unexpected error")
}
