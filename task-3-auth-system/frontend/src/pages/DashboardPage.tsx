import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  getErrorMessage,
  isUnauthorizedError,
} from '../api/auth'

export function DashboardPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    let isCurrent = true

    const loadProfile = async () => {
      setIsLoading(true)
      setError('')

      try {
        const me = await fetchMe(token)
        if (isCurrent) {
          setEmail(me.email)
        }
      } catch (fetchError) {
        if (isUnauthorizedError(fetchError)) {
          clearAuthToken()
          navigate('/login', { replace: true })
          return
        }

        if (isCurrent) {
          setError(getErrorMessage(fetchError))
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isCurrent = false
    }
  }, [navigate])

  const handleLogout = () => {
    clearAuthToken()
    navigate('/login', { replace: true })
  }

  return (
    <main className="page">
      <section className="auth-card dashboard-card">
        <p className="eyebrow">Dashboard</p>
        <h1>Your Session</h1>
        <p className="auth-subtitle">Protected content visible to authenticated users.</p>

        {isLoading ? <p className="status muted">Loading your profile...</p> : null}
        {!isLoading && error ? <p className="status error">{error}</p> : null}
        {!isLoading && !error ? <p className="dashboard-email">{email}</p> : null}

        <div className="dashboard-actions">
          <button className="button button-secondary" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </section>
    </main>
  )
}
