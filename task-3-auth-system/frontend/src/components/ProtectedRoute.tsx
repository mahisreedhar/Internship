import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'

import { getAuthToken } from '../api/auth'

type ProtectedRouteProps = {
  children: ReactElement
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />
  }

  return children
}
