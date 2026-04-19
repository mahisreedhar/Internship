const API_BASE_URL = 'http://127.0.0.1:8000'

export const AUTH_TOKEN_KEY = 'auth_token'

export type AuthPayload = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
}

export type MeResponse = {
  email: string
}

type ApiErrorBody = {
  detail?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiErrorBody
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail
    }
  } catch {
    // Ignore JSON parse errors and fallback to a generic error message.
  }

  return `Request failed with status ${response.status}.`
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  return (await response.json()) as T
}

export async function signup(payload: AuthPayload): Promise<void> {
  await request<{ message: string }>('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function login(payload: AuthPayload): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/api/users/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function isUnauthorizedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}
